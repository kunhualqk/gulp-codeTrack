/*jslint node: true */
/**
 * 进行性能监控的函数
 */
module.exports = function () {
	(function (callback) {
		if (/^(loaded|complete)$/.test(document.readyState)) {
			return callback();
		}
		if (document.addEventListener) {
			return document.addEventListener('DOMContentLoaded', callback, false);
		}
		(function () {
			try {
				document.documentElement.doScroll('left');
				callback();
			}
			catch (err) {
				setTimeout(arguments.callee, 0);
			}
		})();
	})(function () {
		codeTrack("app.timing.domready", "app.init", {autoGroup: 'time'});
		(function (callback) {
			if (/^(loaded|complete)$/.test(document.readyState)) {
				return callback();
			}
			if (window.addEventListener) {
				return window.addEventListener('load', callback, false);
			}
			if (window.attachEvent) {
				return window.attachEvent('onload', callback);
			}
		})(function () {
			setTimeout(function () {
				codeTrack("app.timing.onload", "app.timing.domready", {autoGroup: 'time'});
				var usedJSHeapSize = window.performance && performance.memory && performance.memory.usedJSHeapSize;
				if (usedJSHeapSize) {
					codeTrack("app.memory.onload", "app.init", {group: (usedJSHeapSize <= 0 ? 0 : Math.floor(Math.log(usedJSHeapSize) / Math.log(2)))})
				}
			}, 0)
		});
	});
}