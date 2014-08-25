/*jslint node: true */
var es = require('event-stream');
var fs = require('fs');
var path = require('path');

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

module.exports = function (option) {
	var list=[];
	return {
		implant: function () {
			return es.through(function (file) {
				var self =this;
				this.pause();
				onData(path.join(option.workPath,"baseData.json"),function(data){
					//合并多个version的数据
					var groupData={};
					for(var key in data){
						if(!data[key] || !data[key].totalNum){continue;}
						var group=key.substring(key.indexOf("|")+1);
						(groupData[group]||(groupData[group]={totalNum:0})).totalNum+=data[key].totalNum;
					}
					//计算最大的采样
					var maxNum=0;
					for(var key in groupData){
						maxNum=Math.max(groupData[key].totalNum,maxNum);
					}
					onString(file, function (str) {
						str = str.replace(/\.codeTrack\((.*)\)(?:[\s;]*\/\/+([^\r\n]+))?/g,function(s,param,comment){
							var params=/^\s*['"]([^'"]+)['"](?:\s*,['"]([^'"]*)['"])?/.exec(param),
								map={},
								num= 0,
								value,
								pvLev = maxNum?Math.max(Math.round(Math.log(maxNum)/Math.log(2)),0):20;
							if(!params){console.log(["track format error:",param]);}
							list.push({
								name:params[1],
								datum:params[2],
								file:path.relative(file.cwd,file.path),
								comment:comment
							});
							for(var key in groupData){
								if(key==params[1]){
									pvLev = map._ = Math.round(Math.log(groupData[key].totalNum)/Math.log(2));
									num++;
								}
								if(key.indexOf(params[1]+"|")===0){
									pvLev = map[key.substring(params[1].length+1)]=Math.round(Math.log(groupData[key].totalNum)/Math.log(2));
									num++;
								}
							}
							if(num>1)
							{
								pvLev=JSON.stringify(map);
							}
							return ".codeTrack("+pvLev+","+param+")";
						});
						str = str.replace(/__codeTrack/g,function(){
							return "(" + (function () {
								var trackMap = {}, firstName = "";
								return function (pvLev, name, datumName, config) {
									config = config||{};
									if(config.reject)
									{
										if(typeof(config.reject!="object")){config.reject=[config.reject];}
										for(var i=config.reject.length-1;i>=0;i--)
										{
											if(trackMap[config.reject[i]]){return;}//实现互斥功能
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
										t = now - trackMap[datumName || firstName] || trackMap[firstName];
									}

									switch(config.autoGroup){
										case "time":
											config.group=config.autoGroup+"_"+Math.floor(Math.log(t)/Math.log(2));
											break;
									}
									if (config.group) {//采样分组
										name = name + "|" + config.group;
									}
									if (typeof(pvLev) == "object") {//pv参数分组
										pvLev = pvLev[config.group || "_"] || 0;
									}
									var sampling = Math.round(Math.max(Math.pow(2, pvLev) / (__sampleNumDaily||8192), 1/(__maxSamplingRatio||(1/16))));
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
										"t=" + now
									].join("&");
									img = null;
								}
							}).toString().replace(/__(\w+)/g,function(s,p){
								switch(typeof(option[p]))
								{
									case "function":
										return "("+option[p].toString()+")()";
									case "string":
										return "'"+option[p]+"'";
									case "undefined":
										return "undefined";
									default:
										return option[p];
								}
							}) + ")()";
						})
						file.contents = new Buffer(str);
						self.emit('data', file);
						self.resume();
					})
				});
			},function(){
				console.log("found track place:"+list.length);
				fs.writeFileSync(path.join(option.workPath,"samplingInfo.json"), JSON.stringify(list,null,4))
			})
		},
		sync: function(){
			;
		}
	};
}