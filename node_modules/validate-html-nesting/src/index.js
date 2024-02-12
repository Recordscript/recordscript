const {
	onlyValidChildren,
	onlyValidParents,
	knownInvalidChildren,
	knownInvalidParents,
} = require('./mapping');

/**
 * returns true if given parent-child nesting is valid HTML
 * @param {string} child
 * @param {string} parent
 * @returns {boolean}
 */
function isValidHTMLNesting(parent, child) {
	// if we know the list of children that are the only valid children for the given parent
	if (parent in onlyValidChildren) {
		return onlyValidChildren[parent].has(child);
	}

	// if we know the list of parents that are the only valid parents for the given child
	if (child in onlyValidParents) {
		return onlyValidParents[child].has(parent);
	}

	// if we know the list of children that are NOT valid for the given parent
	if (parent in knownInvalidChildren) {
		// check if the child is in the list of invalid children
		// if so, return false
		if (knownInvalidChildren[parent].has(child)) return false;
	}

	// if we know the list of parents that are NOT valid for the given child
	if (child in knownInvalidParents) {
		// check if the parent is in the list of invalid parents
		// if so, return false
		if (knownInvalidParents[child].has(parent)) return false;
	}

	return true;
}

module.exports = {
	isValidHTMLNesting,
};
