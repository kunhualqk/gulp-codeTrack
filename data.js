/*jslint node: true */
module.exports = function (option) {
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
	var self;
	return self={
		onLocalJson: function (name, callback) {
			var fs = require('fs');
			var path = require('path');
			var filepath = path.join(option.workPath, name);
			fs.exists(filepath, function (exists) {
				if (exists) {
					fs.readFile(filepath, function (err, data) {
						if (err) throw err;
						callback(JSON.parse(data));
					})
				}
				else {
					callback({});
				}
			})
		},
		onRemoteJson: function (url, callback) {
			var http = require('http');
			http.get(url, function (res) {
				var buffers = []
				res.on('data', function (chunk) {
					buffers.push(chunk);
				});
				res.on('end', function () {
					callback(JSON.parse(Buffer.concat(buffers).toString("utf8")));
				});
			});
		},
		onSamplingInfo: createLoader(function (callback) {
			self.onLocalJson("samplingInfo.json",callback);
		}),
		onBaseData:createLoader(function(callback)
		{
			self.onLocalJson("baseData.json",callback);
		}),
		onRemoteData: function (params, callback) {
			self.onRemoteJson(option.reportUri + "url=" + encodeURIComponent(option.dataUri) + "&st=" + params.st + "&et=" + params.et + "",callback);
		},
		onDistribution: createLoader(function (callback) {
			self.onBaseData(function (data) {
				//计算时间倍数
				var allNum = 0, totalNum = 0, hasNull;
				for (var i = Math.floor(data.minTime / 600); i < Math.floor(data.minTime / 600) + 144; i++) {
					if (!data.time || !data.time[i]) {
						hasNull = true;
						break;
					}
					totalNum += data.time[i].totalNum;
				}
				if (hasNull) {
					return callback(null);
				}
				var averageNum = totalNum / 144, distribution = [];
				for (var i = Math.floor(data.minTime / 600); i < Math.floor(data.minTime / 600) + 144; i++) {
					distribution.push(parseFloat(Math.min(Math.max(data.time[i].totalNum / averageNum, 0.01), 100).toFixed(2), 10));
				}
				callback(distribution);
			});
		}),
		onDatumMap:createLoader(function(callback){
			self.onSamplingInfo(function(samplingInfo){
				var datumMap={};
				for(var i=samplingInfo.length-1;i>=0;i--)
				{
					var sampling = samplingInfo[i];
					if(sampling.datum){datumMap[sampling.name] = sampling.datum;}
				}
				callback(datumMap);
			});
		}),
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
		onCurrentInstability: function(callback,now){
			//请求24小时内的数据
			now = Math.ceil((now||new Date())/1000);
			self.onDatumMap(function(datumMap){
			self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400, et: Math.ceil(now / 600) * 600}, function (data) {
				self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400 * 2, et: Math.ceil(now / 600) * 600 - 86400}, function (historyData) {
					//提取采样数据
					var items = {};
					for (var key in data) {
						if (!data[key] || !data[key].totalNum) {
							continue;
						}
						var name = key.substring(key.indexOf("|") + 1);
						var item = items[name] || (items[name] = {
							current: {totalNum: 0, hitsNum: 0},
							pre10Minutes: {totalNum: 0, hitsNum: 0},
							pre24Hours: {totalNum: 0, hitsNum: 0},
							currentHistory: {totalNum: 0, hitsNum: 0},
							pre10MinutesHistory: {totalNum: 0, hitsNum: 0},
							pre24HoursHistory: {totalNum: 0, hitsNum: 0}
						});
						item.pre24Hours.totalNum += data[key].totalNum;
						item.pre24Hours.hitsNum += data[key].hitsNum;
						var time = data[key] && data[key].time;
						if (time && time[Math.floor(data.maxTime / 600)]) {//当前数据
							item.current.totalNum += time[Math.floor(data.maxTime / 600)].totalNum;
							item.current.hitsNum += time[Math.floor(data.maxTime / 600)].hitsNum;
						}
						if (time && time[Math.floor(data.maxTime / 600) - 1]) {//前十分钟数据
							item.pre10Minutes.totalNum += time[Math.floor(data.maxTime / 600) - 1].totalNum;
							item.pre10Minutes.hitsNum += time[Math.floor(data.maxTime / 600) - 1].hitsNum;
						}
					}
					for (var key in historyData) {
						if (!historyData[key] || !historyData[key].totalNum) {
							continue;
						}
						var name = key.substring(key.indexOf("|") + 1);
						var item = items[name] || (items[name] = {
							current: {totalNum: 0, hitsNum: 0},
							pre10Minutes: {totalNum: 0, hitsNum: 0},
							pre24Hours: {totalNum: 0, hitsNum: 0},
							currentHistory: {totalNum: 0, hitsNum: 0},
							pre10MinutesHistory: {totalNum: 0, hitsNum: 0},
							pre24HoursHistory: {totalNum: 0, hitsNum: 0}
						});
						item.pre24HoursHistory.totalNum += historyData[key].totalNum;
						item.pre24HoursHistory.hitsNum += historyData[key].hitsNum;
						var time = historyData[key] && historyData[key].time;
						if (time && time[Math.floor(data.maxTime / 600) - 144]) {//当前数据
							item.currentHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144].totalNum;
							item.currentHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144].hitsNum;
						}
						if (time && time[Math.floor(data.maxTime / 600) - 144 - 1]) {//前十分钟数据
							item.pre10MinutesHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144 - 1].totalNum;
							item.pre10MinutesHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144 - 1].hitsNum;
						}
					}
					//计算不稳定性
					var list=[];
					for (var key in items) {
						items[key].name = key;
						var instability = [], name = key, totalInstability = 0;
						//计算和基准点之间的不稳定性
						if (key.indexOf("|") > 0) {
							name = name.substring(0, name.indexOf("|"));
						}
						if (datumMap[key] && items[datumMap[key]] && items[datumMap[key]].pre24Hours.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
							var totalNumExpect = items[datumMap[key]].current.totalNum * items[key].pre24Hours.totalNum / items[datumMap[key]].pre24Hours.totalNum * (data.maxTime % 600) / 600;
							var hitsNumExpect = totalNumExpect / (items[key].current.totalNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
							if (Math.round(hitsNumExpect) != items[key].current.hitsNum) {
								instability.push({desc: '当前数据('+items[key].current.hitsNum+')<>基准('+Math.round(hitsNumExpect)+')', value: Math.abs(hitsNumExpect - items[key].current.hitsNum) / (hitsNumExpect + items[key].current.hitsNum) * Math.atan(hitsNumExpect + items[key].current.hitsNum)});
								totalInstability += instability[instability.length - 1].value;
							}
						}
						if (datumMap[key] && items[datumMap[key]] && items[datumMap[key]].pre24Hours.totalNum && items[key].pre24Hours.totalNum) {//计算上十分钟内数据和基准对比的不稳定性
							var totalNumExpect = items[datumMap[key]].pre10Minutes.totalNum * items[key].pre24Hours.totalNum / items[datumMap[key]].pre24Hours.totalNum;
							var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.totalNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
							if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum) {
								instability.push({desc: '前十分钟('+items[key].pre10Minutes.hitsNum+')<>基准('+Math.round(hitsNumExpect)+')', value: Math.abs(hitsNumExpect - items[key].pre10Minutes.hitsNum) / (hitsNumExpect + items[key].pre10Minutes.hitsNum) * Math.atan(hitsNumExpect + items[key].pre10Minutes.hitsNum)});
								totalInstability += instability[instability.length - 1].value;
							}
						}
						if (items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
							var totalNumExpect = items[key].currentHistory.totalNum * items[key].pre24Hours.totalNum / items[key].pre24HoursHistory.totalNum * (data.maxTime % 600) / 600;
							var hitsNumExpect = totalNumExpect / (items[key].current.totalNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
							if (Math.round(hitsNumExpect) != items[key].current.hitsNum) {
								instability.push({desc: '当前数据('+items[key].current.hitsNum+')<>历史('+Math.round(hitsNumExpect)+')', value: Math.abs(hitsNumExpect - items[key].current.hitsNum) / (hitsNumExpect + items[key].current.hitsNum) * Math.atan(hitsNumExpect + items[key].current.hitsNum)});
								totalInstability += instability[instability.length - 1].value;
							}
						}
						if (items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
							var totalNumExpect = items[key].pre10MinutesHistory.totalNum * items[key].pre24Hours.totalNum / items[key].pre24HoursHistory.totalNum;
							var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.totalNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
							if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum) {
								instability.push({desc: '前十分钟('+items[key].pre10Minutes.hitsNum+')<>历史('+Math.round(hitsNumExpect)+')', value: Math.abs(hitsNumExpect - items[key].pre10Minutes.hitsNum) / (hitsNumExpect + items[key].pre10Minutes.hitsNum) * Math.atan(hitsNumExpect + items[key].pre10Minutes.hitsNum)});
								totalInstability += instability[instability.length - 1].value;
							}
						}
						instability.sort(function (a, b) {
							return b.value - a.value;
						});
						items[key].instability = instability;
						items[key].instabilityNum = instability[0] ? (instability[0].value + totalInstability/4) : 0;
						list.push(items[key]);
					}
					list.sort(function(a,b){return b.instabilityNum - a.instabilityNum;});
					callback(list);
				});
			});
			});
		}
	};
}