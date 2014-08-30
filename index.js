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
				fs.writeFileSync(path.join(option.workPath,"samplingInfo.json"), JSON.stringify(list,null,4))
			})
		},
		updateData: function(){
			var result=/(\d{4})(\d{2})(\d{2})/.exec(process.argv[3]);
			if(!result){
                return;
            }
			var st=new Date(parseInt(result[1],10),parseInt(result[2],10)-1,parseInt(result[3],10)).valueOf()/1000,
				et=new Date(parseInt(result[1],10),parseInt(result[2],10)-1,parseInt(result[3],10)+1).valueOf()/1000;
			var url = option.dataUri;
			http.get(option.reportUri+"url="+encodeURIComponent(url)+"&st="+st+"&et="+et+"",function(res){
				var buffers = []
				res.on('data', function (chunk) {
					buffers.push(chunk);
				});
				res.on('end', function () {
					var data = JSON.parse(Buffer.concat(buffers).toString("utf8")),timeInfo={};
					for(var key in data)
					{
						var item=data[key];
						if(!item || typeof item!="object" || !item.totalNum){continue;}
						var time = item.time;
						delete item.time;
						for(var key1 in time)
						{
							if(!timeInfo[key1]){timeInfo[key1]={totalNum:0,hitsNum:0};}
							timeInfo[key1].totalNum+=time[key1].totalNum;
							timeInfo[key1].hitsNum+=time[key1].hitsNum;
						}
					}
					data.time=timeInfo;
					fs.writeFileSync(path.join(option.workPath,"baseData.json"), JSON.stringify(data,null,4))
				});
			});
		}
	};
}