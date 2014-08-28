/*jslint node: true */
var through2 = require('through2');
var fs = require('fs');
var path = require('path');
var http = require('http');

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
			return through2.obj(function (file, encoding, callback) {
				var self =this;
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
							var params=/^\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"])?/.exec(param),
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
										if(typeof(config.reject)!="object"){config.reject=[config.reject];}
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
										t = now - (trackMap[datumName || firstName] || trackMap[firstName]);
									}

									switch(config.autoGroup){
										case "time":
											config.group=config.autoGroup+"_"+(t<=0?0:Math.floor(Math.log(t)/Math.log(2)));
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
										"t=" + t
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
						self.push(file);
						callback();
					})
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