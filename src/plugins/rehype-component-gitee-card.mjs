/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a Gitee Card component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.repo - The Gitee repository in the format "owner/repo".
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created Gitee Card component.
 */
export function GiteeCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) {
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("gitee" directive must be leaf type "::gitee{repo="owner/repo"}")',
		]);
	}

	if (!properties.repo || !properties.repo.includes("/")) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid repository. ("repo" attributte must be in the format "owner/repo")',
		);
	}

	const repo = properties.repo;
	const [owner, repoName] = repo.split("/");
	const cardUuid = `GT${Math.random().toString(36).slice(-6)}`;

	const nAvatar = h(`div#${cardUuid}-avatar`, { class: "gc-avatar" });
	const nLanguage = h(
		`span#${cardUuid}-language`,
		{ class: "gc-language" },
		"Waiting...",
	);

	const nTitle = h("div", { class: "gc-titlebar" }, [
		h("div", { class: "gc-titlebar-left" }, [
			h("div", { class: "gc-owner" }, [
				nAvatar,
				h("div", { class: "gc-user" }, owner),
			]),
			h("div", { class: "gc-divider" }, "/"),
			h("div", { class: "gc-repo" }, repoName),
		]),
		h("div", { class: "gitee-logo" }),
	]);

	const nDescription = h(
		`div#${cardUuid}-description`,
		{ class: "gc-description" },
		"Waiting for gitee.com/api/v5/repos...",
	);

	const nStars = h(`div#${cardUuid}-stars`, { class: "gc-stars" }, "00K");
	const nForks = h(`div#${cardUuid}-forks`, { class: "gc-forks" }, "0K");
	const nLicense = h(
		`div#${cardUuid}-license`,
		{ class: "gc-license" },
		"no-license",
	);

	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript", defer: true },
		`
      fetch('https://gitee.com/api/v5/repos/${repo}', { referrerPolicy: "no-referrer" }).then(response => response.json()).then(data => {
        document.getElementById('${cardUuid}-description').innerText = data.description || "Description not set";
        document.getElementById('${cardUuid}-language').innerText = data.language || "Unknown";
        document.getElementById('${cardUuid}-forks').innerText = Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 }).format(data.forks_count || 0).replaceAll("\u202f", '');
        document.getElementById('${cardUuid}-stars').innerText = Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 }).format(data.stargazers_count || 0).replaceAll("\u202f", '');
        const avatarEl = document.getElementById('${cardUuid}-avatar');
        avatarEl.style.backgroundImage = 'url(' + (data.owner?.avatar_url || '') + ')';
        avatarEl.style.backgroundColor = data.owner?.avatar_url ? 'transparent' : 'var(--primary)';
        document.getElementById('${cardUuid}-license').innerText = data.license || "no-license";
        document.getElementById('${cardUuid}-card').classList.remove("fetch-waiting");
        console.log("[GITEE-CARD] Loaded card for ${repo} | ${cardUuid}.")
      }).catch(err => {
        const c = document.getElementById('${cardUuid}-card');
        c?.classList.add("fetch-error");
        console.warn("[GITEE-CARD] (Error) Loading card for ${repo} | ${cardUuid}.", err)
      })
    `,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: "card-gitee card-github fetch-waiting no-styling",
			href: `https://gitee.com/${repo}`,
			target: "_blank",
			repo,
		},
		[
			nTitle,
			nDescription,
			h("div", { class: "gc-infobar" }, [
				nStars,
				nForks,
				nLicense,
				nLanguage,
			]),
			nScript,
		],
	);
}
