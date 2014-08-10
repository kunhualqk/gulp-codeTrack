/*jslint node: true */
var es = require('event-stream');
var fs = require('fs');

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
				onData(option.baseDataPath,function(data){
					onString(file, function (str) {
						str = str.replace(/\.codeTrack\((.*)\)[\s;]*\/\/+([^\r\n]+)/g,function(s,param,comment){
							var params=/^\s*['"]([^'"]+)['"](?:\s*,['"]([^'"]*)['"])?/.exec(param),
								map={},
								num= 0,
								value,
								pvLev = 0;
							list.push([{
								name:params[1],
								datum:params[2],
								comment:comment
							}]);
							for(var key in data){
								if(key==params[1]){
									pvLev = map._ = Math.round(Math.log(data[key].totalNum)/Math.log(2));
									num++;
								}
								if(key.indexOf(params[1]+"_")===0){
									pvLev = map[key]=Math.round(Math.log(data[key].totalNum)/Math.log(2));
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
									if (!firstName) {//记录第一个采样
										firstName = name;
									}
									var now = new Date().valueOf();
									trackMap[name] = now;//记录此采样，不管是否命中采样都需要记录
									if (config.group) {//采样分组
										name = name + "_" + config.group;
									}
									if (typeof(pvLev) == "object") {//pv参数分组
										pvLev = pvLev[config.group || "_"] || 0;
									}
									var sampling = Math.round(Math.min(Math.pow(2, pvLev) / __sampleNumDaily, __maxSamplingRatio));
									if (Math.floor(Math.random() * sampling) > 0) {
										return;
									}
									//计算发送参数
									var t;
									if (name == firstName) {
										var startTime = window.g_config && g_config.startTime;
										t = startTime ? (now - startTime) : 0;
									}
									else {
										t = now - trackMap[datumName || firstName] || trackMap[firstName];
									}


									var url = __dataUrl,
										msg = [
										'[u' + url + ']',
										'[t' + t + ']',
										'[c' + name + ']',
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
									default:
										return option[p];
								}
							}) + ")()";
						})
						file.contents = new Buffer(str);
						self.emit('data', file)
					})
				});
			},function(){
				fs.writeFileSync(option.samplingInfoPath, JSON.stringify(list))
			})
		},
		sync: function(){
			;
		}
	};
}