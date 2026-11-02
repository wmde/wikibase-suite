/**
 * `$( '=property label (P1)' )`
 *
 * @param {string} id
 * @param {string} label
 * @return {Object}
 */
const propertyIdSelector = (
	id: string,
	label: string = id
): ChainablePromiseElement => label === id ?
	$( `=${ id } (${ id })` ) :
	$( `.ui-entityselector-list a[href$="/wiki/Property:${ id }"]` );

export default propertyIdSelector;
