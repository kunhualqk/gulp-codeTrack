/*jslint node: true */
/**
 * 进行性能监控的函数
 */
module.exports = function (params, comment) {
	comment= comment||"";
	return (function(){
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
			codeTrack("__name.domready", "__datum" , {__param:1,autoGroup: 'time'});
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
					codeTrack("__name.onload", "__name.domready", {__param: 1,autoGroup: 'time'});//__comment
					var performance = window.performance;
					if (performance) {
						var entries = performance.getEntries(),
							onloadTiming = performance.timing.loadEventEnd - performance.timing.navigationStart,
							maxEntry = null;
						for (var i = entries.length - 1; i >= 0; i--) {
							if (entries[i].startTime < onloadTiming && (!maxEntry || maxEntry.duration < entries[i].duration)) {
								maxEntry = entries[i];
							}
						}
						if(maxEntry)
						{
							codeTrack("__name.onloadSlowest", "__name.onload", {__param: 1, autoGroup: maxEntry.name.replace(/([^\?])\?[^\?].+$/, "$1").replace(/\W+/g, '_').substr(-32)});
						}
					}
					var usedJSHeapSize = window.performance && performance.memory && performance.memory.usedJSHeapSize;
					if (usedJSHeapSize) {
						codeTrack("__name.onloadMemory", "__name.onload", {__param: 1,group: (usedJSHeapSize <= 0 ? 0 : Math.floor(Math.log(usedJSHeapSize) / Math.log(2)))})
					}
				}, 0)
			});
		});
	}).toString()
		.replace(/__name/g, params[1])
		.replace(/__datum/g, params[2])
		.replace(/__comment/g, comment)
		.replace(/__param\s*:\s*\d+/g, function(){
			return (params[3] && params[3].replace(/^\s*\{/, "").replace(/\}\s*$/, ""))||"_t:0";
		})
}