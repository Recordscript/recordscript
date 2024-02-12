# validate-html-nesting

A parent-child nesting validation library for HTML

This is not a full-blown HTML spec validation (intentionally). The parent-child nesting is considered valid if the Browser does not modify it, regardless of whether or not the HTML spec considers it valid or invalid. So, the library is purely for detecting the kind of element nesting which result in altered DOM.

### Example

```html
<p>
  hello
  <hr/>
</p>
```

The Browser modifies the above-shown structure to the below-shown structure, which is why the library considers the `p > hr` nesting invalid.

```html
<p>hello</p>
<hr />
<p></p>
```

And though `<h1> <div> hi </div> </h1>` markup is technically invalid as per HTML spec, it's still considered valid because the browser does not modify it, so `h1 > div` nesting is considered valid by the library.

<br/>

## Install

```bash
npm i validate-html-nesting
```

<br/>

## API

```javascript
isValidHTMLNesting(parentTag: string, childTag: string) : boolean
```

<br />

## Usage Example

```javascript
import { isValidHTMLNesting } from 'validate-html-nesting';

isValidHTMLNesting('a', 'a'); // false
// because <a> can not be child of <a>

isValidHTMLNesting('p', 'hr'); // false
// because <hr> can not be child of <p>

isValidHTMLNesting('div', 'a'); // true
// because <a> can be child of <div>
```

<br/>

## See also

- [eslint-plugin-validate-jsx-nesting](https://github.com/MananTank/eslint-plugin-validate-jsx-nesting) - ESLint plugin for JSX nesting validation
- [babel-plugin-validate-jsx-nesting](https://github.com/MananTank/validate-jsx-nesting) - Compile time JSX nesting validation

<br/>

## Who is this library for?

This library is mostly useful for UI framework authors who need a way to make sure that the DOM structure rendered by the browser matches the authored markup so that there are no unexpected behaviors

<br/>

## Test Suite

Refer to [validation.test.js](/tests/validation.test.js) to see the full test suite

<br/>

## Contributing

PRs are welcome.
Create an issue if you found a bug.
