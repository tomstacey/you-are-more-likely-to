(function () {
	var $ = function (s) { return document.querySelector(s); };
	var errorBox = $(".error"), errorText = $(".error-text"), factBox = $(".fact"),
		recentBox = $(".recent"), shareLink = $("a.twitter"), againLink = $("a.again"),
		search = $(".search");
	var lastQuery = null;

	var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December"];

	function esc(s) {
		return String(s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	function showError(msg) {
		errorText.textContent = msg || "Couldn't find any crime information about your location.";
		errorBox.style.display = "block";
		factBox.style.display = "none";
		recentBox.style.display = "none";
		againLink.style.display = "none";
		search.focus();
	}

	function show(data) {
		if (!data || data.error) {
			var msg = data && data.reason === "place-not-found" ? "Couldn't find that place. Try a town or a UK postcode."
				: data && data.reason === "no-crime-data" ? "No police.uk crime data for there (it covers England, Wales and Northern Ireland)."
				: null;
			return showError(msg);
		}
		errorBox.style.display = "none";
		var times = Math.round(data.timesmorelikely).toLocaleString("en-GB");
		factBox.innerHTML = "You are <b>" + times + "</b> times more likely to <u>" + esc(data.fact) +
			"</u> than be involved in an incident in <u>" + esc(data.region) + "</u>.";
		factBox.style.display = "block";

		var when = "";
		if (data.month) {
			var p = data.month.split("-");
			when = " in " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
		}
		recentBox.innerHTML = "There were " + (data.capped ? "more than " : "") + "<b>" +
			data.recentcount.toLocaleString("en-GB") + "</b> crimes reported within a mile of there" + esc(when) + ".";
		recentBox.style.display = "block";
		againLink.style.display = "inline-block";

		var text = "I am " + times + " times more likely to " + data.fact + " than be in an incident in " +
			data.region + " #MoreLikelyTo";
		shareLink.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) +
			"&url=" + encodeURIComponent(location.origin);
	}

	function request(params) {
		lastQuery = params;
		factBox.textContent = "Loading your results…";
		factBox.style.display = "block";
		errorBox.style.display = "none";
		fetch("/api/fact?" + new URLSearchParams(params))
			.then(function (r) { return r.json(); })
			.then(show)
			.catch(function () { showError("Something went wrong fetching the data. Try again in a moment."); });
	}

	$(".searchform").addEventListener("submit", function (e) {
		e.preventDefault();
		var q = search.value.trim();
		if (q) request({ q: q });
	});

	againLink.addEventListener("click", function (e) {
		e.preventDefault();
		if (lastQuery) request(lastQuery);
	});

	if ("geolocation" in navigator) {
		navigator.geolocation.getCurrentPosition(
			function (pos) { request({ lat: pos.coords.latitude.toFixed(5), lon: pos.coords.longitude.toFixed(5) }); },
			function () { showError("No location? No problem. Where are you?"); },
			{ timeout: 10000, maximumAge: 600000 }
		);
	} else {
		showError("No location? No problem. Where are you?");
	}
})();
