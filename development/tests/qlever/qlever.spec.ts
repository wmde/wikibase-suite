import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

type Binding = { value: string; datatype?: string };

const qleverQuery = async (
	query: string
): Promise<Record<string, Binding>[]> => {
	const result = await browser.makeRequest('http://qlever:7001/', {
		params: { query, format: 'application/sparql-results+json' }
	});
	expect(result.status).toEqual(200);
	return result.data.results.bindings;
};

const waitForBindings = async (
	query: string,
	predicate: (bindings: Record<string, Binding>[]) => boolean,
	timeoutMsg: string
): Promise<void> => {
	await browser.waitUntil(async () => predicate(await qleverQuery(query)), {
		interval: 1000,
		timeoutMsg
	});
};

const editEntity = async (id: string, data: object): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request({
		action: 'wbeditentity',
		id,
		data: JSON.stringify(data),
		token: await api.getEditToken()
	});
};

const deleteEntity = async (id: string): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request({
		action: 'delete',
		title: `Item:${id}`,
		token: await api.getEditToken()
	});
};

describe('QLever incremental updater', function () {
	it('indexes a newly-created statement with its entity RDF snapshot', async function () {
		const propertyId = await WikibaseApi.createProperty('string');
		const value = getTestString('qlever-incremental-value-');
		const itemId = await WikibaseApi.createItem(getTestString('qlever-item-'), {
			claims: [
				{
					mainsnak: {
						snaktype: 'value',
						property: propertyId,
						datavalue: { value, type: 'string' }
					},
					type: 'statement',
					rank: 'normal'
				}
			]
		});

		await waitForBindings(
			`
				SELECT ?value WHERE {
					<${testEnv.vars.WIKIBASE_URL}/entity/${itemId}>
						<${testEnv.vars.WIKIBASE_URL}/prop/direct/${propertyId}> ?value
				}`,
			(bindings) => bindings.some((binding) => binding.value.value === value),
			`Expected QLever to index the ${itemId} statement`
		);
	});

	it('replaces an entity graph after an edit without retaining stale RDF', async function () {
		const firstLabel = getTestString('qlever-old-label-');
		const secondLabel = getTestString('qlever-new-label-');
		const itemId = await WikibaseApi.createItem(firstLabel);
		await editEntity(itemId, {
			labels: { en: { language: 'en', value: secondLabel } }
		});

		await waitForBindings(
			`SELECT ?label WHERE {
				<${testEnv.vars.WIKIBASE_URL}/entity/${itemId}>
					<http://www.w3.org/2000/01/rdf-schema#label> ?label
			}`,
			(bindings) =>
				bindings.length === 1 && bindings[0].label.value === secondLabel,
			`Expected QLever to replace ${itemId} with its edited RDF graph`
		);
	});

	it('replays an edit made while the updater is interrupted', async function () {
		const label = getTestString('qlever-replayed-edit-');
		let updaterStopped = false;

		try {
			await testEnv.runDockerComposeCmd('stop wdqs-qlever-updater');
			updaterStopped = true;
			const itemId = await WikibaseApi.createItem(label);
			const query = `SELECT ?item WHERE {
				?item <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(label)}@en
			}`;

			expect(await qleverQuery(query)).toHaveLength(0);
			await testEnv.runDockerComposeCmd(
				'up -d --no-deps --force-recreate wdqs-qlever-updater'
			);
			updaterStopped = false;

			await waitForBindings(
				query,
				(bindings) =>
					bindings.some((binding) =>
						binding.item.value.endsWith(`/entity/${itemId}`)
					),
				`Expected QLever to replay the change to ${itemId} after the updater restarted`
			);
		} finally {
			if (updaterStopped) {
				await testEnv.runDockerComposeCmd(
					'up -d --no-deps --force-recreate wdqs-qlever-updater'
				);
			}
		}
	});

	it('updates property RDF and retains only an updater timestamp on deletion', async function () {
		const firstLabel = getTestString('qlever-property-old-');
		const secondLabel = getTestString('qlever-property-new-');
		const propertyId = await WikibaseApi.createProperty('string', {
			labels: { en: { language: 'en', value: firstLabel } }
		});
		await editEntity(propertyId, {
			labels: { en: { language: 'en', value: secondLabel } }
		});
		await waitForBindings(
			`SELECT ?label WHERE {
				<${testEnv.vars.WIKIBASE_URL}/entity/${propertyId}>
					<http://www.w3.org/2000/01/rdf-schema#label> ?label
			}`,
			(bindings) =>
				bindings.length === 1 && bindings[0].label.value === secondLabel,
			`Expected QLever to replace ${propertyId} property RDF`
		);

		const itemId = await WikibaseApi.createItem(
			getTestString('qlever-deleted-item-')
		);
		await waitForBindings(
			`SELECT ?p WHERE { <${testEnv.vars.WIKIBASE_URL}/entity/${itemId}> ?p ?o }`,
			(bindings) => bindings.length > 0,
			`Expected QLever to index ${itemId} before deletion`
		);
		await deleteEntity(itemId);
		await waitForBindings(
			`SELECT ?p WHERE { <${testEnv.vars.WIKIBASE_URL}/entity/${itemId}> ?p ?o }`,
			(bindings) =>
				bindings.length === 1 &&
				bindings[0].p.value === 'http://wikiba.se/ontology#timestamp',
			`Expected QLever to retain only the deleted ${itemId} timestamp`
		);
	});

	it('drains a Recent Changes backlog across pagination boundaries', async function () {
		const label = getTestString('qlever-pagination-');
		const itemCount = 55;
		await testEnv.runDockerComposeCmd('stop wdqs-qlever-updater');
		try {
			for (let index = 0; index < itemCount; index++) {
				await WikibaseApi.createItem(label);
			}
		} finally {
			await testEnv.runDockerComposeCmd('up -d --no-deps wdqs-qlever-updater');
		}

		await waitForBindings(
			`SELECT (COUNT(?item) AS ?count) WHERE {
				?item <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(label)}@en
			}`,
			(bindings) => bindings[0]?.count.value === String(itemCount),
			`Expected QLever to drain all ${itemCount} Recent Changes events`
		);
	});

	it('resumes an interrupted full export and replays its high-water cutover', async function () {
		const propertyId = await WikibaseApi.createProperty('string');
		const value = getTestString('qlever-full-bootstrap-');
		const postExportLabel = getTestString('qlever-post-export-');
		const itemId = await WikibaseApi.createItem(
			getTestString('qlever-bootstrap-item-'),
			{
				claims: [
					{
						mainsnak: {
							snaktype: 'value',
							property: propertyId,
							datavalue: { value, type: 'string' }
						},
						type: 'statement',
						rank: 'normal'
					}
				]
			}
		);
		const query = `SELECT ?value WHERE {
			<${testEnv.vars.WIKIBASE_URL}/entity/${itemId}>
				<${testEnv.vars.WIKIBASE_URL}/prop/direct/${propertyId}> ?value
		}`;

		await waitForBindings(
			query,
			(bindings) => bindings.some((binding) => binding.value.value === value),
			`Expected QLever to index ${itemId} before the full bootstrap cutover`
		);

		await testEnv.runDockerComposeCmd(
			'up -d --no-deps --force-recreate query-bootstrap'
		);
		await browser.waitUntil(
			async () => {
				const output = await testEnv.runDockerComposeCmd(
					'exec -T wdqs-qlever-updater cat /data/qlever-export-checkpoint.json'
				);
				const checkpoint = JSON.parse(output);
				return checkpoint.status === 'exporting' && checkpoint.chunk >= 1;
			},
			{
				interval: 100,
				timeoutMsg:
					'Expected the full bootstrap export to capture its high-water mark'
			}
		);
		await testEnv.runDockerComposeCmd('stop query-bootstrap');
		await testEnv.runDockerComposeCmd(
			'exec -T wdqs-qlever-updater test -f /data/qlever-bootstrap.lock'
		);
		await testEnv.runDockerComposeCmd(
			'up -d --no-deps --force-recreate query-bootstrap'
		);
		await testEnv.runDockerComposeCmd('wait query-bootstrap');
		// Edit after export: the static input must not already contain this change.
		// The updater must stay paused until indexing, then replay the edit.
		await editEntity(itemId, {
			labels: { en: { language: 'en', value: postExportLabel } }
		});
		await testEnv.runDockerComposeCmd(
			'exec -T wdqs-qlever-updater test -f /data/qlever-bootstrap.lock'
		);
		const healthBefore = JSON.parse(await testEnv.runDockerComposeCmd(
			'exec -T wdqs-qlever-updater cat /data/wdqs-qlever-updater-health.json'
		));
		await browser.waitUntil(async () => {
			const health = JSON.parse(await testEnv.runDockerComposeCmd(
				'exec -T wdqs-qlever-updater cat /data/wdqs-qlever-updater-health.json'
			));
			return health.checkedAt !== healthBefore.checkedAt;
		}, { interval: 1000, timeoutMsg: 'Expected the live updater to remain paused after export' });
		expect(await qleverQuery(`SELECT ?item WHERE {
			?item <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(postExportLabel)}@en
		}`)).toHaveLength(0);
		await testEnv.runDockerComposeCmd('stop qlever');
		await testEnv.runDockerComposeCmd('run --rm --no-deps query-indexer');
		await testEnv.runDockerComposeCmd('up -d --wait --no-deps qlever');

		await waitForBindings(
			`SELECT ?label WHERE {
				<${testEnv.vars.WIKIBASE_URL}/entity/${itemId}>
					<http://www.w3.org/2000/01/rdf-schema#label> ?label
			}`,
			(bindings) =>
				bindings.length === 1 && bindings[0].label.value === postExportLabel,
			`Expected the updater to replay ${itemId} after the bootstrap high-water mark`
		);
	});

	it('retries an edit after QLever becomes temporarily unavailable', async function () {
		const label = getTestString('qlever-unavailable-');
		await testEnv.runDockerComposeCmd('stop qlever');
		let itemId: string;
		try {
			itemId = await WikibaseApi.createItem(label);
			await browser.waitUntil(
				async () => {
					const output = await testEnv.runDockerComposeCmd(
						'exec -T wdqs-qlever-updater cat /data/wdqs-qlever-updater-health.json'
					);
					return JSON.parse(output).error !== undefined;
				},
				{
					interval: 1000,
					// Allow the updater's 30-second HTTP timeout plus its polling interval.
					timeout: 60000,
					timeoutMsg: 'Expected the updater to record its failed QLever request'
				}
			);
		} finally {
			await testEnv.runDockerComposeCmd('up -d --wait --no-deps qlever');
		}
		await waitForBindings(
			`SELECT ?item WHERE {
				?item <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(label)}@en
			}`,
			(bindings) =>
				bindings.some((binding) =>
					binding.item.value.endsWith(`/entity/${itemId}`)
				),
			`Expected QLever to receive ${itemId} after becoming available again`
		);
	});

	it('recovers an unprocessed edit after Wikibase becomes temporarily unavailable', async function () {
		const label = getTestString('qlever-wikibase-unavailable-');
		let wikibaseStopped = false;
		try {
			await testEnv.runDockerComposeCmd('stop wdqs-qlever-updater');
			const itemId = await WikibaseApi.createItem(label);
			await testEnv.runDockerComposeCmd('stop wikibase');
			wikibaseStopped = true;
			await testEnv.runDockerComposeCmd(
				'up -d --no-deps --force-recreate wdqs-qlever-updater'
			);

			await browser.waitUntil(
				async () => {
					const status = JSON.parse(
						await testEnv.runDockerComposeCmd(
							'ps --format json wdqs-qlever-updater'
						)
					) as { State?: string } | Array<{ State?: string }>;
					const services = Array.isArray(status) ? status : [status];
					return services.some((service) => service.State === 'restarting');
				},
				{
					interval: 250,
					timeoutMsg:
						'Expected the updater to restart while its Wikibase source is unavailable'
				}
			);

			await testEnv.runDockerComposeCmd('up -d --wait --no-deps wikibase');
			wikibaseStopped = false;
			await waitForBindings(
				`SELECT ?item WHERE {
					?item <http://www.w3.org/2000/01/rdf-schema#label> ${JSON.stringify(label)}@en
				}`,
				(bindings) =>
					bindings.some((binding) =>
						binding.item.value.endsWith(`/entity/${itemId}`)
					),
				`Expected QLever to catch up ${itemId} once Wikibase becomes available again`
			);
		} finally {
			if (wikibaseStopped) {
				await testEnv.runDockerComposeCmd('up -d --wait --no-deps wikibase');
			}
		}
	});

	it('refuses to advance when Recent Changes retention no longer covers its cursor', async function () {
		const expiredState = JSON.stringify({
			timestamp: '2000-01-01T00:00:00Z',
			rcid: 0
		});
		await testEnv.runDockerComposeCmd('stop wdqs-qlever-updater');
		await testEnv.runDockerComposeCmd(
			`run --rm --no-deps --entrypoint sh wdqs-qlever-updater -c 'printf %s ${JSON.stringify(expiredState)} > /data/wdqs-qlever-updater-state.json'`
		);
		await testEnv.runDockerComposeCmd(
			'up -d --no-deps --force-recreate wdqs-qlever-updater'
		);

		let health: { error?: string; state?: { rcid?: number } } = {};
		await browser.waitUntil(
			async () => {
				const output = await testEnv.runDockerComposeCmd(
					'exec -T wdqs-qlever-updater cat /data/wdqs-qlever-updater-health.json'
				);
				health = JSON.parse(output);
				return (
					health.error?.includes(
						'Recent Changes retention no longer covers the updater cursor'
					) ?? false
				);
			},
			{
				interval: 1000,
				timeoutMsg:
					'Expected an expired Recent Changes cursor to be reported as an actionable updater error'
			}
		);
		expect(health.state?.rcid).toEqual(0);
	});
});
