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
				if (res.statusCode == "301" || res.statusCode == "302") {
					return self.onRemoteJson(res.headers.location, callback);
				}
				var buffers = [];
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
			var url = option.reportUri + "url=" + encodeURIComponent(option.dataUri) + "&st=" + params.st + "&et=" + params.et ;
			if (option.dataToken) {
				url += "&url_token=" + option.dataToken;
			}
			if (option.dataUriPostfix) {
				url += "&" + option.dataUriPostfix;
			}

			self.onRemoteJson(url ,function(data){
				//对远程数据进行修正
				for(var key in data){
					if(!data || !data[key]){continue;}
					if(data[key].totalNum && data[key].totalNum<0){
						data[key].totalNum=Math.round(data[key].totalDelay*data[key].hitsNum/data[key].totalHitsDelay);
					}
					if(!data[key].time){continue;}
					for(var key1 in data[key].time){
						var item=data[key].time[key1];
						if(item && item.totalNum && item.totalNum<0){
							item.totalNum=Math.round(item.totalDelay*item.hitsNum/item.totalHitsDelay);
						}
					}
				}
				callback(data);
			});
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
					datumMap[sampling.name] = sampling.datum||"";
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
				onData({st: st, et: st + 14400-1}, function (data) {
					//合并数据
					for(var key in data)
					{
						if(!data[key] || !data[key].totalNum || !data[key].time){continue;}
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
		onCurrentInstability: function (callback, now, timeRange) {
			function cmp(m, n) {
				if (m < n) {
					return cmp(n, m);
				}
				var max = option.sampleNumDaily || 8192;
				if(m>max){
					m=max;
					n=Math.round(n*max/m);
				}
				var p = 1.0, np, result = 0, step = 512, stepNum = Math.pow(2, step);
				for (var i = n + 1; i <= m; i++) {
					np = p * (m - n + i) / i;
					if (!np || isNaN(np) || np === Infinity) {
						if (p > 1) {
							p /= stepNum;
							result += step;
						}
						else {
							p *= stepNum;
							result -= step;
						}
						np = p * (m - n + i) / i;
					}
					p = np;
				}
				return (result + Math.log(p) / Math.log(2))*Math.abs(Math.atan2(m,n)-Math.PI/4);
			}
			timeRange=timeRange||86400;
			var self = this;//6小时
			//请求24小时内的数据
			now = Math.ceil((now || new Date()) / 1000);
			self.onDatumMap(function (datumMap) {
				self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400, et: Math.ceil(now / 600) * 600}, function (data) {
					self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400 * 2, et: Math.ceil(now / 600) * 600 - 86400}, function (historyData) {
						function createItem() {
							return {
								current: {totalNum: 0, hitsNum: 0},
								pre10Minutes: {totalNum: 0, hitsNum: 0},
								preRange: {totalNum: 0, hitsNum: 0},
								pre24Hours: {totalNum: 0, hitsNum: 0},
								currentHistory: {totalNum: 0, hitsNum: 0},
								pre10MinutesHistory: {totalNum: 0, hitsNum: 0},
								preRangeHistory: {totalNum: 0, hitsNum: 0},
								pre24HoursHistory: {totalNum: 0, hitsNum: 0},
							}
						}

						//提取采样数据
						var items = {};
						for (var key in data) {
							if (!data[key] || !data[key].totalNum) {
								continue;
							}
							var name = key.substring(key.indexOf("|") + 1),
								groupName = name.indexOf("|") > 0 ? name.substring(0, name.indexOf("|")) : "",
								item = items[name] || (items[name] = createItem()),
								groupItem = groupName ? (items[groupName] || (items[groupName] = createItem())) : null;
							item.pre24Hours.totalNum += data[key].totalNum;
							item.pre24Hours.hitsNum += data[key].hitsNum;
							item.pre24Hours.exampleURL = data[key].exampleURL;
							if (groupItem) {
								groupItem.pre24Hours.totalNum += data[key].totalNum;
								groupItem.pre24Hours.hitsNum += data[key].hitsNum;
								groupItem.pre24Hours.exampleURL = data[key].exampleURL;
							}
							var time = data[key] && data[key].time;
							for(var i=Math.floor(data.maxTime / 600);i>=Math.floor((data.maxTime - timeRange)/ 600);i--)
							{
								var timeItem = time && time[i];
								if(!timeItem){continue;}
								item.preRange.totalNum += timeItem.totalNum;
								item.preRange.hitsNum += timeItem.hitsNum;
								item.preRange.exampleURL = timeItem.exampleURL;
								if (groupItem) {
									groupItem.preRange.totalNum += timeItem.totalNum;
									groupItem.preRange.hitsNum += timeItem.hitsNum;
									groupItem.preRange.exampleURL = timeItem.exampleURL;
								}
							}
							if (time && time[Math.floor(data.maxTime / 600)]) {//当前数据
								item.current.totalNum += time[Math.floor(data.maxTime / 600)].totalNum;
								item.current.hitsNum += time[Math.floor(data.maxTime / 600)].hitsNum;
								item.current.exampleURL = time[Math.floor(data.maxTime / 600)].exampleURL;
								if (groupItem) {
									groupItem.current.totalNum += time[Math.floor(data.maxTime / 600)].totalNum;
									groupItem.current.hitsNum += time[Math.floor(data.maxTime / 600)].hitsNum;
									groupItem.current.exampleURL = time[Math.floor(data.maxTime / 600)].exampleURL;
								}
							}
							if (time && time[Math.floor(data.maxTime / 600) - 1]) {//前十分钟数据
								item.pre10Minutes.totalNum += time[Math.floor(data.maxTime / 600) - 1].totalNum;
								item.pre10Minutes.hitsNum += time[Math.floor(data.maxTime / 600) - 1].hitsNum;
								item.pre10Minutes.exampleURL = time[Math.floor(data.maxTime / 600) - 1].exampleURL;
								if (groupItem) {
									groupItem.pre10Minutes.totalNum += time[Math.floor(data.maxTime / 600) - 1].totalNum;
									groupItem.pre10Minutes.hitsNum += time[Math.floor(data.maxTime / 600) - 1].hitsNum;
									groupItem.pre10Minutes.exampleURL = time[Math.floor(data.maxTime / 600) - 1].exampleURL;
								}
							}
						}
						for (var key in historyData) {
							if (!historyData[key] || !historyData[key].totalNum) {
								continue;
							}
							var name = key.substring(key.indexOf("|") + 1),
								groupName = name.indexOf("|") > 0 ? name.substring(0, name.indexOf("|")) : "",
								item = items[name] || (items[name] = createItem()),
								groupItem = groupName ? (items[groupName] || (items[groupName] = createItem())) : null;
							item.pre24HoursHistory.totalNum += historyData[key].totalNum;
							item.pre24HoursHistory.hitsNum += historyData[key].hitsNum;
							item.pre24HoursHistory.exampleURL = historyData[key].exampleURL;
							if (groupItem) {
								groupItem.pre24HoursHistory.totalNum += historyData[key].totalNum;
								groupItem.pre24HoursHistory.hitsNum += historyData[key].hitsNum;
								groupItem.pre24HoursHistory.exampleURL = historyData[key].exampleURL;
							}
							var time = historyData[key] && historyData[key].time;

							for(var i=Math.floor(data.maxTime / 600)- 144;i>=Math.floor((data.maxTime - timeRange)/ 600)- 144;i--)
							{
								var timeItem = time && time[i];
								if(!timeItem){continue;}
								item.preRangeHistory.totalNum += timeItem.totalNum;
								item.preRangeHistory.hitsNum += timeItem.hitsNum;
								item.preRangeHistory.exampleURL = timeItem.exampleURL;
								if (groupItem) {
									groupItem.preRangeHistory.totalNum += timeItem.totalNum;
									groupItem.preRangeHistory.hitsNum += timeItem.hitsNum;
									groupItem.preRangeHistory.exampleURL = timeItem.exampleURL;
								}
							}
							if (time && time[Math.floor(data.maxTime / 600) - 144]) {//当前数据
								item.currentHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144].totalNum;
								item.currentHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144].hitsNum;
								item.currentHistory.exampleURL = time[Math.floor(data.maxTime / 600) - 144].exampleURL;
								if (groupItem) {
									groupItem.currentHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144].totalNum;
									groupItem.currentHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144].hitsNum;
									groupItem.currentHistory.exampleURL = time[Math.floor(data.maxTime / 600) - 144].exampleURL;
								}
							}
							if (time && time[Math.floor(data.maxTime / 600) - 144 - 1]) {//前十分钟数据
								item.pre10MinutesHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144 - 1].totalNum;
								item.pre10MinutesHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144 - 1].hitsNum;
								item.pre10MinutesHistory.exampleURL = time[Math.floor(data.maxTime / 600) - 144 - 1].exampleURL;
								if (groupItem) {
									groupItem.pre10MinutesHistory.totalNum += time[Math.floor(data.maxTime / 600) - 144 - 1].totalNum;
									groupItem.pre10MinutesHistory.hitsNum += time[Math.floor(data.maxTime / 600) - 144 - 1].hitsNum;
									groupItem.pre10MinutesHistory.exampleURL = time[Math.floor(data.maxTime / 600) - 144 - 1].exampleURL;
								}
							}
						}
						//计算不稳定性
						var list = [];
						for (var key in items) {
							items[key].name = key;
							var datumName = key.indexOf("|") > 0 ? key.substring(0, key.indexOf("|")) : datumMap[key];
							if((!datumName || datumName==key) && (key!="app.init"))
							{
								datumName="app.init";
							}
							items[key].datumName = datumName;
							var instability = [], unitRatio = 0.5,
								credibleNum=4;	//采样个数大于此值，才会信任此采样比例

							var currentInstability = {},currentInstabilityValue;//当前时间段的不稳定性
							if (datumName && items[datumName] && items[datumName].preRange.totalNum && items[key].preRange.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[datumName].current.totalNum * items[key].preRange.totalNum / items[datumName].preRange.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].current.hitsNum>credibleNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].preRange.totalNum / items[key].preRange.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].current.hitsNum && (currentInstabilityValue=cmp(hitsNumExpect, items[key].current.hitsNum))) {
									currentInstability.descDatum = '当前数据(' + items[key].current.hitsNum + ')<>基准(' + Math.round(hitsNumExpect) + ')';
									currentInstability.valueDatum = currentInstabilityValue;
								}
								else{
									currentInstability=null;
								}
							}
							//因为服务端不是严格按照时间处理数据，因此无法得知当前数据占10分钟的比例，而依靠app.init进行时间判断也有较大的不确定性，因此暂时无法支持对历史数据进行分析
							if (currentInstability && items[key].preRangeHistory.totalNum && items[key].preRange.totalNum && items['app.init'] && items['app.init'].current.hitsNum>credibleNum && items['app.init'].pre10Minutes.hitsNum>credibleNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[key].currentHistory.totalNum * items[key].preRange.totalNum / items[key].preRangeHistory.totalNum * items['app.init'].current.totalNum / items['app.init'].pre10Minutes.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].current.hitsNum>credibleNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].preRange.totalNum / items[key].preRange.hitsNum);
								if (Math.round(hitsNumExpect) < items[key].current.hitsNum) {
									currentInstability.descHistory= '当前数据(' + items[key].current.hitsNum + ')<>历史(' + Math.round(hitsNumExpect) + ')';
									currentInstability.valueHistory= cmp(hitsNumExpect, items[key].current.hitsNum);
								}
							}
							if(currentInstability && (currentInstability.valueDatum || currentInstability.valueHistory)){
								currentInstability.value = currentInstability.valueDatum?(currentInstability.valueDatum+Math.min(currentInstability.valueDatum,currentInstability.valueHistory||0)*unitRatio):currentInstability.valueHistory;
								currentInstability.desc=!currentInstability.valueHistory || currentInstability.valueHistory<currentInstability.valueDatum?currentInstability.descDatum:currentInstability.descHistory;
								instability.push(currentInstability);
							}

							var historyInstability = {},historyInstabilityValue;//前十分钟的不稳定性
							if (datumName && items[datumName] && items[datumName].preRange.totalNum && items[key].preRange.totalNum) {//计算上十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[datumName].pre10Minutes.totalNum * items[key].preRange.totalNum / items[datumName].preRange.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.hitsNum>credibleNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].preRange.totalNum / items[key].preRange.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum && (historyInstabilityValue=cmp(hitsNumExpect, items[key].pre10Minutes.hitsNum))) {
									historyInstability.descDatum='前十分钟(' + items[key].pre10Minutes.hitsNum + ')<>基准(' + Math.round(hitsNumExpect) + ')';
									historyInstability.valueDatum= historyInstabilityValue;
								}
								else
								{
									historyInstability=null;
								}
							}
							if (historyInstability && items[key].preRangeHistory.totalNum && items[key].preRange.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[key].pre10MinutesHistory.totalNum * items[key].preRange.totalNum / items[key].preRangeHistory.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.hitsNum>credibleNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].preRange.totalNum / items[key].preRange.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum) {
									historyInstability.descHistory= '前十分钟(' + items[key].pre10Minutes.hitsNum + ')<>历史(' + Math.round(hitsNumExpect) + ')';
									historyInstability.valueHistory= cmp(hitsNumExpect, items[key].pre10Minutes.hitsNum);
								}
							}
							if(historyInstability && (historyInstability.valueDatum || historyInstability.valueHistory)){
								historyInstability.value = historyInstability.valueDatum?(historyInstability.valueDatum+Math.min(historyInstability.valueDatum,historyInstability.valueHistory||0)*unitRatio):historyInstability.valueHistory;
								historyInstability.desc=!historyInstability.valueHistory || historyInstability.valueHistory<historyInstability.valueDatum?historyInstability.descDatum:historyInstability.descHistory;
								instability.push(historyInstability);
							}

							instability.sort(function (a, b) {
								return b.value - a.value;
							});
							items[key].instability = instability;
							//不稳定性计算算法，主要以做最不稳定的数值为基准，其他的按照名次依次减权
							var instabilityNum = 0, unit = 1;
							for (var i = 0; i < instability.length; i++) {
								instabilityNum += instability[i].value * unit;
								unit = unit * unitRatio;
							}
							items[key].instabilityNum = instabilityNum;
							list.push(items[key]);
						}
						list.sort(function (a, b) {
							return b.instabilityNum - a.instabilityNum;
						});
						callback(list);
					});
				});
			});
		}
	};
}