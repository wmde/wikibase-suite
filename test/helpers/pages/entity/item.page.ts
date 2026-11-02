import { Page } from '../page.js';
import urlParameters from '../url-parameters.js';

type ItemPageParams = {
	action?: string;
};

class ItemPage extends Page {
	/**
	 * `/wiki/Item:${itemId}
	 *
	 * @param {string} itemId
	 * @param {Object} params - Optional
	 * @param {string} params.action - Optional
	 * @return {void}
	 */
	public async open(
		itemId: string,
		params: ItemPageParams = {}
	): Promise<void> {
		return super.open( `/wiki/Item:${ itemId }${ urlParameters( params ) }` );
	}
}

export default new ItemPage();
