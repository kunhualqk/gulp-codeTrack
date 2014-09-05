/*jslint node: true */
var fs = require('fs');
var path = require('path');
var Data = require('./data');
var UglifyJS = require("uglify-js");

/**
 * @param {Object} option 选项
 * @param {String} option.workPath 工作路径
 * @param {String} option.dataUri 统计数据的数据服务分类URL，例如：http://myhosts/track/'
 * @param {String} option.reportUri 获取统计数据的服务器URL
 * @param {String} option.version 版本号
 * @param {Number} [option.sampleNumDaily=8192] 每天每个样本期望收到的采样数
 * @param {Number} [option.maxSamplingRatio=1/16] 最大采样比例，可以避免向服务器发送过多数据
 * @param {Number} [option.defaultSamplingRatio=1/128] 默认采样比例（在没有数据来计算采样比例时使用，例如新增样本）
 */
module.exports = function (option) {
	var trackdata = Data(option);
	return {
		implantStr: function (str,callback,cfg) {
			trackdata.onBaseData(function (data) {
				//合并多个version的数据
				var groupData = {};
				for (var key in data) {
					if (!data[key] || !data[key].totalNum) {
						continue;
					}
					var group = key.substring(key.indexOf("|") + 1);
					(groupData[group] || (groupData[group] = {totalNum: 0})).totalNum += data[key].totalNum;
				}
				trackdata.onDistribution(function (distribution) {
					str = str.replace(/\.codeTrack\((.*)\)(?:[\s;]*\/\/+([^\r\n]+))?/g, function (s, param, comment) {
						var params = /^\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"])?/.exec(param),
							map = {},
							num = 0,
							value,
							pvLev = Math.round(Math.log((option.sampleNumDaily || 8192) / (option.defaultSamplingRatio || (1 / 128))) / Math.log(2));
						if (!params) {
							cfg && cfg.onError && cfg.onError(param);
							return s;
						}
						cfg && cfg.onSampling && cfg.onSampling({
							name: params[1],
							datum: params[2],
							comment: comment
						});
						for (var key in groupData) {
							if (key == params[1]) {
								pvLev = map._ = Math.round(Math.log(groupData[key].totalNum) / Math.log(2));
								num++;
							}
							if (key.indexOf(params[1] + "|") === 0) {
								pvLev = map[key.substring(params[1].length + 1)] = Math.round(Math.log(groupData[key].totalNum) / Math.log(2));
								num++;
							}
						}
						if (num > 1) {
							pvLev = JSON.stringify(map);
						}
						return ".codeTrack(" + pvLev + "," + param + ")";
					});
					str = str.replace(/__codeTrack/g, function () {
						return "(" + (function () {
							var trackMap = {}, firstName = "";
							return function (pvLev, name, datumName, config) {
								config = config || {};
								if (config.reject) {
									if (typeof(config.reject) != "object") {
										config.reject = [config.reject];
									}
									for (var i = config.reject.length - 1; i >= 0; i--) {
										if (trackMap[config.reject[i]]) {
											return;
										}//实现互斥功能
									}
								}
								if (!firstName) {//记录第一个采样
									firstName = name;
								}
								var now = new Date().valueOf();
								trackMap[name] = now;//记录此采样，不管是否命中采样都需要记录

								// 计算时间参数
								var t;
								if (name == firstName) {
									var startTime = window.g_config && g_config.startTime;
									t = startTime ? (now - startTime) : 0;
								}
								else {
									t = now - (trackMap[datumName || firstName] || trackMap[firstName]);
								}

								switch (config.autoGroup) {
									case "time":
										config.group = config.autoGroup + "_" + (t <= 0 ? 0 : Math.floor(Math.log(t) / Math.log(2)));
										break;
								}
								if (config.group) {//采样分组
									name = name + "|" + config.group;
								}
								if (typeof(pvLev) == "object") {//pv参数分组
									pvLev = pvLev[config.group || "_"] || 0;
								}
								var distribution = __distribution,
									timeFactor = distribution ? distribution[Math.floor((now + 28800000) / (86400000 / 144)) % 144] : 1,
									sampling = Math.round(Math.max(Math.pow(2, pvLev) / timeFactor / (__sampleNumDaily || 8192), 1 / (__maxSamplingRatio || (1 / 16))));
								if (Math.floor(Math.random() * sampling) > 0) {
									return;
								}

								var url = __dataUri,
									msg = [
										'[u' + url + ']',
										'[t' + t + ']',
										'[c' + __version + '|' + name + ']',
										'[r' + sampling + ']'
									].join("");
								var nick = "", result;
								try {
									result = /_nk_=([^;]+)/.exec(document.cookie);
									if (result) {
										nick = decodeURIComponent(result[1]);
									}
								} catch (e) {
								}

								var n = 'jsFeImage_' + now + "_" + Math.random(),
									img = window[n] = new Image();
								img.onload = img.onerror = function () {
									window[n] = null;
								};
								img.src = "http://gm.mmstat.com/ued.1.1.2?" + [
									"type=9",
									"id=jstracker",
									"v=0.01",
									"nick=" + encodeURIComponent(nick),
									"islogin=0",
									"msg=" + encodeURIComponent(msg),
									"file=" + encodeURIComponent(url),
									"line=" + sampling,
									"scrolltop=" + ((document.documentElement && document.documentElement.scrollTop) || (document.body && document.body.scrollTop) || 0),
									"screen=" + screen.width + "x" + screen.height,
									"t=" + t
								].join("&");
								img = null;
							}
						}).toString().replace(/__(\w+)/g, function (s, p) {
								if (p == "distribution") {
									return JSON.stringify(distribution);
								}
								switch (typeof(option[p])) {
									case "function":
										return "(" + option[p].toString() + ")()";
									case "string":
										return "'" + option[p] + "'";
									case "undefined":
										return "undefined";
									default:
										return option[p];
								}
							}) + ")()";
					})
					callback(new Buffer(str));

				});
			});
		},
		updateReport: function(list){
			fs.writeFileSync(path.join(option.workPath, "samplingInfo.json"), JSON.stringify(list, null, 4));
			var html = fs.readFileSync(path.join(__dirname, 'report.html'), {encoding: "utf8"});
			html = html.replace("__TrackOption", JSON.stringify({
				dataUri: option.dataUri,
				reportUri: option.reportUri
			}))
			html = html.replace("__TrackData", function(){
				return UglifyJS.minify(fs.readFileSync(path.join(__dirname, 'data.js'), {encoding: "utf8"}), {fromString: true}).code;
			})
			fs.writeFileSync(path.join(option.workPath, "report.html"), html);
		},
		updateData: function(params){
			trackdata.onRemoteData(params,function(data){
				var timeInfo = {};
				for (var key in data) {
					var item = data[key];
					if (!item || typeof item != "object" || !item.totalNum) {
						continue;
					}
					var time = item.time;
					delete item.time;
					for (var key1 in time) {
						if (!timeInfo[key1]) {
							timeInfo[key1] = {totalNum: 0, hitsNum: 0};
						}
						timeInfo[key1].totalNum += time[key1].totalNum;
						timeInfo[key1].hitsNum += time[key1].hitsNum;
					}
				}
				data.time = timeInfo;
				fs.writeFileSync(path.join(option.workPath, "baseData.json"), JSON.stringify(data, null, 4))
			});
		},
		monitor: function(){
			var self=this;
			trackdata.onDatumMap(function(datumMap){
				function run(){
					trackdata.onCurrentInstability(function(instabilityMap){
						console.log(instabilityMap);
					},Math.ceil(new Date()/1000),datumMap);
				}
				run();
				setInterval(run,Math.pow(2,17));
			});
		},
		command:function(argu){
			switch(argu[0].replace(/^-+/,''))
			{
				case "updatedata":
					var result=/(\d{4})(\d{2})(\d{2})/.exec(argu[1]);
					if(!result){
		                return;
		            }
					var st=new Date(parseInt(result[1],10),parseInt(result[2],10)-1,parseInt(result[3],10)).valueOf()/1000,
						et=new Date(parseInt(result[1],10),parseInt(result[2],10)-1,parseInt(result[3],10)+1).valueOf()/1000;
					this.updateData({st:st,et:et});
					break;
				case "monitor":
					this.monitor();
					break;
				default:
					console.log("unknown commend:"+argu[0]);
			}
		}
	};
}