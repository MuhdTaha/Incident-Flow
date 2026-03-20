import '@testing-library/jest-dom'

jest.mock('react-markdown', () => {
	const React = require('react');
	return {
		__esModule: true,
		default: ({ children }) => React.createElement(React.Fragment, null, children),
	};
});