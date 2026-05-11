import assert from "node:assert/strict";
import test from "node:test";

import {
	injectBackgroundColor,
	injectTheme,
} from "../../src/plugins/plantuml-encoder.js";

test("injectTheme inserts the theme directive right after @startuml", () => {
	const source = "@startuml\nAlice -> Bob\n@enduml";
	const themed = injectTheme(source, "cyborg");

	assert.equal(
		themed,
		"@startuml\n!theme cyborg\nAlice -> Bob\n@enduml",
	);
});

test("injectBackgroundColor adds a dark canvas when no explicit background is present", () => {
	const source = "@startuml\n!theme cyborg\nAlice -> Bob\n@enduml";
	const themed = injectBackgroundColor(source, "#050816");

	assert.equal(
		themed,
		"@startuml\nskinparam backgroundColor #050816\n!theme cyborg\nAlice -> Bob\n@enduml",
	);
});

test("injectBackgroundColor respects an explicit PlantUML background color", () => {
	const source =
		"@startuml\nskinparam backgroundColor transparent\nAlice -> Bob\n@enduml";

	assert.equal(injectBackgroundColor(source, "#050816"), source);
});
