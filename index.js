/*jslint node: true */
var through2 = require('through2');
var fs = require('fs');
var path = require('path');
var http = require('http');

function createLoader(load) {
	var value, loading, handles = [], h;
	return function (handle, type) {
		//type默认为1
		//0:	不立即加载，不过加载完成之后执行回调函数
		//1:	立即加载，并在完成之后执行回调函数
		//2:	不立即加载，只在当前已经存在的情况下执行回调函数
		if (type !== 0 && !type) {
			type = 1;
		}
		if ((type & 1) && !loading) {
			loading = true;
			load(function (v) {
				value = v;
				while (h = handles.shift()) {
					h && h.apply(null, [value]);
				}
			})
		}
		if (value !== undefined) {
			handle && handle.apply(null, [value]);
			return value;
		}
		if (!(type & 2)) {
			handle && handles.push(handle);
		}//如果只在存在的情况下回调，则退出
		return value;
	}
}

function onString(file, callback) {
	if (file.isBuffer()) {
		callback(String(file.contents));
	}
	else if (file.isStream) {
		var bufs = [];
		file.contents.on('data', function (d) {
			bufs.push(d);
		});
		file.contents.on('end', function () {
			callback(String(Buffer.concat(bufs)));
		});
	}
	else {
		callback("");
	}
}

function onData(path, callback)
{
	fs.exists(path,function(exists){
		if(exists)
		{
			fs.readFile(path, function(err,data){
				callback(JSON.parse(data));
			})
		}
		else
		{
			callback({});
		}
	})
}
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
	var list=[],
		dataLoader=createLoader(function(callback){
			onData(path.join(option.workPath,"baseData.json"),callback);
		}),
		distributionLoader=createLoader(function(callback){
			dataLoader(function(data){
				//计算时间倍数
				var allNum = 0, totalNum = 0, hasNull;
				for (var i = Math.floor(data.minTime / 600); i < Math.floor(data.minTime / 600) + 144; i++) {
					if (!data.time || !data.time[i]) {
						hasNull = true;
						break;
					}
					totalNum += data.time[i].totalNum;
				}
				if(hasNull){return callback(null);}
				var averageNum = totalNum/144,distribution=[];
				for (var i = Math.floor(data.minTime / 600); i < Math.floor(data.minTime / 600) + 144; i++) {
					distribution.push(parseFloat(Math.min(Math.max(data.time[i].totalNum/averageNum,0.01),100).toFixed(2),10));
				}
				callback(distribution);
			});
		});
	return {
		implant: function () {
			return through2.obj(function (file, encoding, callback) {
				var self =this;
				dataLoader(function(data){
					//合并多个version的数据
					var groupData={};
					for(var key in data){
						if(!data[key] || !data[key].totalNum){continue;}
						var group=key.substring(key.indexOf("|")+1);
						(groupData[group]||(groupData[group]={totalNum:0})).totalNum+=data[key].totalNum;
					}
					distributionLoader(function(distribution){
						onString(file, function (str) {
							str = str.replace(/\.codeTrack\((.*)\)(?:[\s;]*\/\/+([^\r\n]+))?/g, function (s, param, comment) {
								var params = /^\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"])?/.exec(param),
									map = {},
									num = 0,
									value,
									pvLev = Math.round(Math.log((option.sampleNumDaily || 8192) / (option.defaultSamplingRatio || (1 / 128))) / Math.log(2));
								if (!params) {
									console.log(["track format error:", param]);
								}
								list.push({
									name: params[1],
									datum: params[2],
									file: path.relative(file.cwd, file.path),
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
											timeFactor = distribution?distribution[Math.floor((now+28800000)/(86400000/144))%144]:1,
											sampling = Math.round(Math.max(Math.pow(2, pvLev)/ timeFactor / (__sampleNumDaily || 8192), 1 / (__maxSamplingRatio || (1 / 16))));
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
							file.contents = new Buffer(str);
							self.push(file);
							callback();
						})
					});
				});
			},function(){
				console.log("found track place:"+list.length);
				fs.writeFileSync(path.join(option.workPath,"samplingInfo.json"), JSON.stringify(list,null,4));
				fs.writeFileSync(path.join(option.workPath,"report.html"), fs.readFileSync(path.join(__dirname, 'report.html'),{encoding:"utf8"}).replace("__TrackOption",JSON.stringify({
					dataUri:option.dataUri,
					reportUri:option.reportUri
				})));
			})
		},
		onRemoteData: function(params,callback)
		{
			http.get(option.reportUri + "url=" + encodeURIComponent(option.dataUri) + "&st=" + params.st + "&et=" + params.et + "", function (res) {
				var buffers = []
				res.on('data', function (chunk) {
					buffers.push(chunk);
				});
				res.on('end', function () {
					callback(JSON.parse(Buffer.concat(buffers).toString("utf8")));
				});
			});
		},
		onBufferData: function(params,callback)
		{
			var self = this,
				count = 0,
				totalData ={minTime:0,maxTime:0};
			function onData(param,callback)
			{
				setTimeout(function () {
					if (!self["_buffer_" + param.st] || !self._maxTime || param.et > self._maxTime+1) {
						self["_buffer_" + param.st] = createLoader(function (callback) {
							self.onRemoteData(param, callback);
						});
					}
					self["_buffer_" + param.st](callback);
				}, 0);
			}
			//对数据分段请求
			for(var st=Math.floor(params.st/14400)*14400;st<params.et;st+=14400){
				count++;
				onData({st: st, et: st + 14400}, function (data) {
					//合并数据
					for(var key in data)
					{
						if(!data[key].totalNum || !data[key].time){continue;}
						for (var t in data[key].time) {
							if(t*600>=params.et || (t*1+1)*600<=params.st){continue;}
							var totalItem = totalData[key] || (totalData[key] = {totalNum: 0, hitsNum: 0, totalDelay: 0, totalHitsDelay: 0, time: {}});
							var minTime = Math.min(Math.max(t*600,data.minTime),data.maxTime+1);
							var maxTime = Math.min(Math.max((t*1+1)*600-1,data.minTime),data.maxTime+1);
							totalData.maxTime = totalData.maxTime?Math.max(totalData.maxTime, maxTime):maxTime;
							totalData.minTime = totalData.minTime?Math.min(totalData.minTime, minTime):minTime;
							self._maxTime = self._maxTime?Math.max(self._maxTime, maxTime):maxTime;

							var timeItem = data[key].time[t];
							totalItem.totalNum += timeItem.totalNum;
							totalItem.hitsNum += timeItem.hitsNum;
							totalItem.totalDelay += timeItem.totalDelay;
							totalItem.totalHitsDelay += timeItem.totalHitsDelay;
							totalItem.exampleURL = data[key].time[t].exampleURL;
							var totalTimeItem = totalItem.time[t] || (totalItem.time[t] = {totalNum: 0, hitsNum: 0, totalDelay: 0, totalHitsDelay: 0})
							totalTimeItem.totalNum += timeItem.totalNum;
							totalTimeItem.hitsNum += timeItem.hitsNum;
							totalTimeItem.totalDelay += timeItem.totalDelay;
							totalTimeItem.totalHitsDelay += timeItem.totalHitsDelay;
							totalTimeItem.exampleURL = timeItem.exampleURL;
						}
					}
					if ((--count) === 0) {
						callback(totalData);
					}
				});
			}
		},
		updateData: function(params){
			this.onRemoteData(params,function(data){
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
			fs.readFile(path.join(option.workPath,"samplingInfo.json"),function(err,samplingInfoStr){
				if (err) throw err;
				var samplingInfo = JSON.parse(samplingInfoStr),datumMap={};
				for(var i=samplingInfo.length-1;i>=0;i--)
				{
					var sampling = samplingInfo[i];
					if(sampling.datum){datumMap[sampling.name] = sampling.datum;}
				}
				function run(){
					var now=Math.ceil(new Date()/1000);
					//请求24小时内的数据
					self.onBufferData({st:Math.ceil(now/600)*600-86400,et:Math.ceil(now/600)*600},function(data){
						self.onBufferData({st:Math.ceil(now/600)*600-86400*2,et:Math.ceil(now/600)*600-86400},function(historyData){
							//提取采样数据
							var items={};
							for(var key in data){
								if(!data[key] || !data[key].totalNum){continue;}
								var name = key.substring(key.indexOf("|")+1);
								var item = items[name] || (items[name]={
									current:{totalNum:0,hitsNum:0},
									pre10Minutes:{totalNum:0,hitsNum:0},
									pre24Hours:{totalNum:0,hitsNum:0},
									currentHistory:{totalNum:0,hitsNum:0},
									pre10MinutesHistory:{totalNum:0,hitsNum:0},
									pre24HoursHistory:{totalNum:0,hitsNum:0}
								});
								item.pre24Hours.totalNum+=data[key].totalNum;
								item.pre24Hours.hitsNum+=data[key].hitsNum;
								var time=data[key] && data[key].time;
								if(time && time[Math.floor(data.maxTime/600)])
								{//当前数据
									item.current.totalNum+=time[Math.floor(data.maxTime/600)].totalNum;
									item.current.hitsNum+=time[Math.floor(data.maxTime/600)].hitsNum;
								}
								if(time && time[Math.floor(data.maxTime/600)-1])
								{//前十分钟数据
									item.pre10Minutes.totalNum+=time[Math.floor(data.maxTime/600)-1].totalNum;
									item.pre10Minutes.hitsNum+=time[Math.floor(data.maxTime/600)-1].hitsNum;
								}
							}
							for(var key in historyData){
								if(!historyData[key] || !historyData[key].totalNum){continue;}
								var name = key.substring(key.indexOf("|")+1);
								var item = items[name] || (items[name]={
									current:{totalNum:0,hitsNum:0},
									pre10Minutes:{totalNum:0,hitsNum:0},
									pre24Hours:{totalNum:0,hitsNum:0},
									currentHistory:{totalNum:0,hitsNum:0},
									pre10MinutesHistory:{totalNum:0,hitsNum:0},
									pre24HoursHistory:{totalNum:0,hitsNum:0}
								});
								item.pre24HoursHistory.totalNum+=historyData[key].totalNum;
								item.pre24HoursHistory.hitsNum+=historyData[key].hitsNum;
								var time=historyData[key] && historyData[key].time;
								if(time && time[Math.floor(data.maxTime/600)-144])
								{//当前数据
									item.currentHistory.totalNum+=time[Math.floor(data.maxTime/600)-144].totalNum;
									item.currentHistory.hitsNum+=time[Math.floor(data.maxTime/600)-144].hitsNum;
								}
								if(time && time[Math.floor(data.maxTime/600)-144-1])
								{//前十分钟数据
									item.pre10MinutesHistory.totalNum+=time[Math.floor(data.maxTime/600)-144-1].totalNum;
									item.pre10MinutesHistory.hitsNum+=time[Math.floor(data.maxTime/600)-144-1].hitsNum;
								}
							}
							//计算不稳定性
							for(var key in items)
							{
								var instability = [],name=key,totalInstability=0;
								//计算和基准点之间的不稳定性
								if(key.indexOf("|")>0)
								{
									name = name.substring(0,name.indexOf("|"));
								}
								if(datumMap[key] && items[datumMap[key]] && items[datumMap[key]].pre24Hours.totalNum && items[key].pre24Hours.totalNum)
								{//计算当前不足十分钟内数据和基准对比的不稳定性
									var totalNumExpect = items[datumMap[key]].current.totalNum*items[key].pre24Hours.totalNum/items[datumMap[key]].pre24Hours.totalNum*(data.maxTime%600)/600;
									var hitsNumExpect = totalNumExpect/(items[key].current.totalNum?items[key].current.totalNum/items[key].current.hitsNum:items[key].pre24Hours.totalNum/items[key].pre24Hours.hitsNum);
									if(Math.round(hitsNumExpect)!=items[key].current.hitsNum)
									{
										instability.push({desc:'当前数据和基准的偏差',value:Math.abs(hitsNumExpect-items[key].current.hitsNum)/(hitsNumExpect+items[key].current.hitsNum)*Math.atan(hitsNumExpect+items[key].current.hitsNum)});
										totalInstability+=instability[instability.length-1].value;
									}
								}
								if(datumMap[key] && items[datumMap[key]] && items[datumMap[key]].pre24Hours.totalNum && items[key].pre24Hours.totalNum)
								{//计算上十分钟内数据和基准对比的不稳定性
									var totalNumExpect = items[datumMap[key]].pre10Minutes.totalNum*items[key].pre24Hours.totalNum/items[datumMap[key]].pre24Hours.totalNum;
									var hitsNumExpect = totalNumExpect/(items[key].pre10Minutes.totalNum?items[key].pre10Minutes.totalNum/items[key].pre10Minutes.hitsNum:items[key].pre24Hours.totalNum/items[key].pre24Hours.hitsNum);
									if(Math.round(hitsNumExpect)!=items[key].pre10Minutes.hitsNum)
									{
										instability.push({desc:'前十分钟数据和基准的偏差',value:Math.abs(hitsNumExpect-items[key].pre10Minutes.hitsNum)/(hitsNumExpect+items[key].pre10Minutes.hitsNum)*Math.atan(hitsNumExpect+items[key].pre10Minutes.hitsNum)});
										totalInstability+=instability[instability.length-1].value;
									}
								}
								if(datumMap[key] && items[datumMap[key]] && items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum)
								{//计算当前不足十分钟内数据和基准对比的不稳定性
									var totalNumExpect = items[key].currentHistory.totalNum*items[key].pre24Hours.totalNum/items[key].pre24HoursHistory.totalNum*(data.maxTime%600)/600;
									var hitsNumExpect = totalNumExpect/(items[key].current.totalNum?items[key].current.totalNum/items[key].current.hitsNum:items[key].pre24Hours.totalNum/items[key].pre24Hours.hitsNum);
									if(Math.round(hitsNumExpect)!=items[key].current.hitsNum)
									{
										instability.push({desc:'当前数据和历史的偏差',value:Math.abs(hitsNumExpect-items[key].current.hitsNum)/(hitsNumExpect+items[key].current.hitsNum)*Math.atan(hitsNumExpect+items[key].current.hitsNum)});
										totalInstability+=instability[instability.length-1].value;
									}
								}
								if(datumMap[key] && items[datumMap[key]] && items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum)
								{//计算当前不足十分钟内数据和基准对比的不稳定性
									var totalNumExpect = items[key].pre10MinutesHistory.totalNum*items[key].pre24Hours.totalNum/items[key].pre24HoursHistory.totalNum;
									var hitsNumExpect = totalNumExpect/(items[key].pre10Minutes.totalNum?items[key].pre10Minutes.totalNum/items[key].pre10Minutes.hitsNum:items[key].pre24Hours.totalNum/items[key].pre24Hours.hitsNum);
									if(Math.round(hitsNumExpect)!=items[key].pre10Minutes.hitsNum)
									{
										instability.push({desc:'前十分钟数据和历史的偏差',value:Math.abs(hitsNumExpect-items[key].pre10Minutes.hitsNum)/(hitsNumExpect+items[key].pre10Minutes.hitsNum)*Math.atan(hitsNumExpect+items[key].pre10Minutes.hitsNum)});
										totalInstability+=instability[instability.length-1].value;
									}
								}
								instability.sort(function(a,b){return b.value- a.value;});
								item.instability=instability;
								item.instabilityNum=instability[0]?(instability[0].value+Math.log(totalInstability)):0;
							}
						});
					});
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