/* @refresh reload */
import { render } from "solid-js/web";

import App from "./RecordControl";
import "./styles.css";

render(() => <App />, document.getElementById("root") as HTMLElement);
