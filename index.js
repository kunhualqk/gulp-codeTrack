/*jslint node: true */
var through2 = require('through2');
var fs = require('fs');
var path = require('path');
var CodeTrack = require('./codetrack');

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
	var trackList = [],
		fileList = [],
		trackMap = {};
	var codetrack = CodeTrack(option);
	codetrack.implant = function () {
		if(option.dataAutoUpdateDay){//如果需要自动更新数据
			var dataAutoUpdateDay= option.dataAutoUpdateDay==7? 0: option.dataAutoUpdateDay,
				baseDataPath = path.join(option.workPath, "baseData.json"),
				now = new Date(),
				today = (+new Date(now.getFullYear(),now.getMonth(),now.getDate()))/1000,
				offsetDays = now.getDay() - dataAutoUpdateDay,
				newMinTime = today - (offsetDays>0?offsetDays:(offsetDays+7))*24*60*60,
				newMaxTime = newMinTime+ 24 * 60 * 60-1,
				baseMaxTime = 0;
			if (fs.existsSync(baseDataPath)) {
				var baseData = JSON.parse(fs.readFileSync(baseDataPath));
				baseMaxTime = baseData.maxTime;
			}
			if(newMaxTime-baseMaxTime> 4 * 60 * 60)//如果时间相差四小时以上
			{
				try{
				codetrack.updateData({st: newMinTime,et: newMaxTime});
				}
				catch(err){}
			}
		}
		return through2.obj(function (file, encoding, callback) {
			var self = this;
			onString(file, function (str) {
				var trackNum = 0,
					filePath = path.relative(file.cwd, file.path);
				codetrack.implantStr(str, function (str) {
					file.contents = new Buffer(str);
					self.push(file);
					if(str.length){
						fileList.push({
							trackNum:trackNum,
							codeLen:str.length,
							file:filePath
						});
					}
					callback();
				}, {
					onError:function(param){
						console.log(["[codetrack] Track format error:", param]);
					},
					onSampling: function (item) {
						item.file = filePath;
						trackMap[item.name]++;
						trackList.push(item);
						trackNum++;
					}
				});
			});
		}, function (done) {
			console.log("[codetrack] Found "+trackList.length+" track point in " + fileList.length + " files;");
			fileList.sort(function(a,b){return a.trackNum/ a.codeLen-b.trackNum/b.codeLen});
			var fileStr=[];
			for(var i=0;i<10;i++)
			{
				if(!fileList[i]){break;}
				fileStr.push(fileList[i].file+"("+fileList[i].trackNum+")");
			}
			console.log("[codetrack] Lowest ratio files:"+fileStr.join(",")+";");
			codetrack.updateReport(trackList);
			done();
		})
	}
	return codetrack;
}