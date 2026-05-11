import test from "node:test";
import assert from "node:assert/strict";

import { createCalendarDataVersion } from "../../../../../src/components/widgets/calendar/utils/calendarDataVersion.js";

const published = new Date("2026-05-08T08:00:00+08:00");
const updatedA = new Date("2026-05-08T20:00:00+08:00");
const updatedB = new Date("2026-05-10T00:12:00+08:00");

test("calendar data version changes when post title changes", () => {
	const original = createCalendarDataVersion([
		{
			id: "edgeone-pages-deploy",
			data: {
				title: "旧标题",
				published,
				updated: updatedA,
			},
		},
	]);

	const renamed = createCalendarDataVersion([
		{
			id: "edgeone-pages-deploy",
			data: {
				title: "新标题",
				published,
				updated: updatedA,
			},
		},
	]);

	assert.notEqual(original, renamed);
});

test("calendar data version changes when post updated time changes", () => {
	const original = createCalendarDataVersion([
		{
			id: "waline-edgeone-pages-proxy",
			data: {
				title: "通过 EdgeOne Pages 给 Vercel 上的 Waline 做访问加速",
				published,
				updated: updatedA,
			},
		},
	]);

	const updated = createCalendarDataVersion([
		{
			id: "waline-edgeone-pages-proxy",
			data: {
				title: "通过 EdgeOne Pages 给 Vercel 上的 Waline 做访问加速",
				published,
				updated: updatedB,
			},
		},
	]);

	assert.notEqual(original, updated);
});
