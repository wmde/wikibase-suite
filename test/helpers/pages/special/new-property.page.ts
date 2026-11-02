import SubmittablePage from '../submittable.page.js';
import urlParameters from '../url-parameters.js';

type SpecialNewPropertyPageParams = {
	datatype?: string;
};

class SpecialNewPropertyPage extends SubmittablePage {
	public get aliasesInput(): ChainablePromiseElement {
		return $( 'input[name="aliases"]' );
	}

	public get datatypeInput(): ChainablePromiseElement {
		return $( '#wb-newproperty-datatype' );
	}

	public get descriptionInput(): ChainablePromiseElement {
		return $( 'input[name="description"]' );
	}

	public get labelInput(): ChainablePromiseElement {
		return $( 'input[name="label"]' );
	}

	public get submitBtn(): ChainablePromiseElement {
		return $( 'button[value="Create"]' );
	}

	/**
	 * `/wiki/Special:NewProperty`
	 *
	 * @param {Object} params
	 * @param {string} params.datatype - Optional
	 * @return {void}
	 */
	public async open(
		params: SpecialNewPropertyPageParams | string = {}
	): Promise<void> {
		if ( typeof params === 'string' ) {
			throw new Error( 'Invalid parameter' );
		}

		await super.open( `/wiki/Special:NewProperty${ urlParameters( params ) }` );
		await this.labelInput;
		await this.descriptionInput;
		await this.aliasesInput;
		await this.datatypeInput;
		await this.submitBtn;
	}

	public async submit(): Promise<void> {
		await super.submit();
		await browser.waitUntil(
			async () => /\/wiki\/Property:P\d+/.test( await browser.getUrl() ),
			{ timeoutMsg: 'Expected new property page after submitting form' }
		);
	}
}

export default new SpecialNewPropertyPage();
