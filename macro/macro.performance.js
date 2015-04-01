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
			codeTrack("macro.performance.domready", "__datum" , {__param:1,autoGroup: 'time'});
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
					codeTrack("macro.performance.onload", "macro.performance.domready", {__param: 1,autoGroup: 'time'});//__comment
					var usedJSHeapSize = window.performance && performance.memory && performance.memory.usedJSHeapSize;
					if (usedJSHeapSize) {
						codeTrack("macro.performance.onloadMemory", "macro.performance.onload", {__param: 1,group: (usedJSHeapSize <= 0 ? 0 : Math.floor(Math.log(usedJSHeapSize) / Math.log(2)))})
					}
				}, 0)
			});
		});
	}).toString()
		.replace(/__datum/g, params[2])
		.replace(/__comment/g, comment)
		.replace(/__param\s*:\s*\d+/g, function(){
			return (params[3] && params[3].replace(/^\s*\{/, "").replace(/\}\s*$/, ""))||"_t:0";
		})
}