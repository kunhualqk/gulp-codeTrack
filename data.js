/*jslint node: true */
var Big;
(function(n){"use strict";function t(n){var f,i,e,u=this;if(!(u instanceof t))return new t(n);if(n instanceof t){u.s=n.s;u.e=n.e;u.c=n.c.slice();return}for(n===0&&1/n<0?n="-0":l.test(n+="")||r(NaN),u.s=n.charAt(0)=="-"?(n=n.slice(1),-1):1,(f=n.indexOf("."))>-1&&(n=n.replace(".","")),(i=n.search(/e/i))>0?(f<0&&(f=i),f+=+n.slice(i+1),n=n.substring(0,i)):f<0&&(f=n.length),i=0;n.charAt(i)=="0";i++);if(i==(e=n.length))u.c=[u.e=0];else{for(;n.charAt(--e)=="0";);for(u.e=f-i-1,u.c=[],f=0;i<=e;u.c[f++]=+n.charAt(i++));}}function o(n,t,i,u){var e=n.c,f=n.e+t+1;if(i===1?u=e[f]>=5:i===2?u=e[f]>5||e[f]==5&&(u||f<0||e[f+1]!=null||e[f-1]&1):i===3?u=u||e[f]!=null||f<0:(u=!1,i!==0)&&r("!Big.RM!"),f<1||!e[0])n.c=u?(n.e=-t,[1]):[n.e=0];else{if(e.length=f--,u)for(;++e[f]>9;)e[f]=0,f--||(++n.e,e.unshift(1));for(f=e.length;!e[--f];e.pop());}return n}function r(n){var t=new Error(n);t.name="BigError";throw t;}function h(n,i,r){var u=i-(n=new t(n)).e,e=n.c;for(e.length>++i&&o(n,u,t.RM),u=e[0]?r?i:(e=n.c,n.e+u+1):u+1;e.length<u;e.push(0));return u=n.e,r==1||r==2&&(i<=u||u<=f)?(n.s<0&&e[0]?"-":"")+(e.length>1?(e.splice(1,0,"."),e.join("")):e[0])+(u<0?"e":"e+")+u:n.toString()}t.DP=20;t.RM=1;var u=1e6,c=1e6,f=-7,e=21,i=t.prototype,l=/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,s=new t(1);i.abs=function(){var n=new t(this);return n.s=1,n};i.cmp=function(n){var o,h=this,f=h.c,e=(n=new t(n)).c,i=h.s,s=n.s,r=h.e,u=n.e;if(!f[0]||!e[0])return f[0]?i:e[0]?-s:0;if(i!=s)return i;if(o=i<0,r!=u)return r>u^o?1:-1;for(i=-1,s=(r=f.length)<(u=e.length)?r:u;++i<s;)if(f[i]!=e[i])return f[i]>e[i]^o?1:-1;return r==u?0:r>u^o?1:-1};i.div=function(n){var b=this,l=b.c,h=(n=new t(n)).c,p=b.s==n.s?1:-1,a=t.DP;if((a!==~~a||a<0||a>u)&&r("!Big.DP!"),!l[0]||!h[0])return l[0]==h[0]&&r(NaN),h[0]||r(p/0),new t(p*0);var c,k,w,v,e,it=h.slice(),d=c=h.length,rt=l.length,i=l.slice(0,c),f=i.length,y=new t(s),g=y.c=[],nt=0,tt=a+(y.e=b.e-n.e)+1;for(y.s=p,p=tt<0?0:tt,it.unshift(0);f++<c;i.push(0));do{for(w=0;w<10;w++){if(c!=(f=i.length))v=c>f?1:-1;else for(e=-1,v=0;++e<c;)if(h[e]!=i[e]){v=h[e]>i[e]?1:-1;break}if(v<0){for(k=f==c?h:it;f;){if(i[--f]<k[f]){for(e=f;e&&!i[--e];i[e]=9);--i[e];i[f]+=10}i[f]-=k[f]}for(;!i[0];i.shift());}else break}g[nt++]=v?w:++w;i[0]&&v?i[f]=l[d]||0:i=[l[d]]}while((d++<rt||i[0]!=null)&&p--);return g[0]||nt==1||(g.shift(),y.e--),nt>tt&&o(y,a,t.RM,i[0]!=null),y};i.eq=function(n){return!this.cmp(n)};i.gt=function(n){return this.cmp(n)>0};i.gte=function(n){return this.cmp(n)>-1};i.lt=function(n){return this.cmp(n)<0};i.lte=function(n){return this.cmp(n)<1};i.minus=function(n){var e,o,s,l,h=this,f=h.s,r=(n=new t(n)).s;if(f!=r)return n.s=-r,h.plus(n);var i=h.c.slice(),a=h.e,u=n.c,c=n.e;if(!i[0]||!u[0])return u[0]?(n.s=-r,n):new t(i[0]?h:0);if(f=a-c){for(e=(l=f<0)?(f=-f,i):(c=a,u),e.reverse(),r=f;r--;e.push(0));e.reverse()}else for(s=((l=i.length<u.length)?i:u).length,f=r=0;r<s;r++)if(i[r]!=u[r]){l=i[r]<u[r];break}if(l&&(e=i,i=u,u=e,n.s=-n.s),(r=-((s=i.length)-u.length))>0)for(;r--;i[s++]=0);for(r=u.length;r>f;){if(i[--r]<u[r]){for(o=r;o&&!i[--o];i[o]=9);--i[o];i[r]+=10}i[r]-=u[r]}for(;i[--s]==0;i.pop());for(;i[0]==0;i.shift(),--c);return i[0]||(n.s=1,i=[c=0]),n.c=i,n.e=c,n};i.mod=function(n){n=new t(n);var e,i=this,u=i.s,f=n.s;return n.c[0]||r(NaN),i.s=n.s=1,e=n.cmp(i)==1,i.s=u,n.s=f,e?new t(i):(u=t.DP,f=t.RM,t.DP=t.RM=0,i=i.div(n),t.DP=u,t.RM=f,this.minus(i.times(n)))};i.plus=function(n){var e,o=this,r=o.s,f=(n=new t(n)).s;if(r!=f)return n.s=-f,o.minus(n);var h=o.e,i=o.c,s=n.e,u=n.c;if(!i[0]||!u[0])return u[0]?n:new t(i[0]?o:r*0);if(i=i.slice(),r=h-s){for(e=r>0?(s=h,u):(r=-r,i),e.reverse();r--;e.push(0));e.reverse()}for(i.length-u.length<0&&(e=u,u=i,i=e),r=u.length,f=0;r;f=(i[--r]=i[r]+u[r]+f)/10^0,i[r]%=10);for(f&&(i.unshift(f),++s),r=i.length;i[--r]==0;i.pop());return n.c=i,n.e=s,n};i.pow=function(n){var f=n<0,i=new t(this),u=s;for((n!==~~n||n<-c||n>c)&&r("!pow!"),n=f?-n:n;;){if(n&1&&(u=u.times(i)),n>>=1,!n)break;i=i.times(i)}return f?s.div(u):u};i.round=function(n,i){var f=new t(this);return n==null?n=0:(n!==~~n||n<0||n>u)&&r("!round!"),o(f,n,i==null?t.RM:i),f};i.sqrt=function(){var f,n,e,u=this,h=u.c,i=u.s,s=u.e,c=new t("0.5");if(!h[0])return new t(u);i<0&&r(NaN);i=Math.sqrt(u.toString());i==0||i==1/0?(f=h.join(""),f.length+s&1||(f+="0"),n=new t(Math.sqrt(f).toString()),n.e=((s+1)/2|0)-(s<0||s&1)):n=new t(i.toString());i=n.e+(t.DP+=4);do e=n,n=c.times(e.plus(u.div(e)));while(e.c.slice(0,i).join("")!==n.c.slice(0,i).join(""));return o(n,t.DP-=4,t.RM),n};i.times=function(n){var i,h=this,e=h.c,o=(n=new t(n)).c,s=e.length,r=o.length,f=h.e,u=n.e;if(n.s=h.s==n.s?1:-1,!e[0]||!o[0])return new t(n.s*0);for(n.e=f+u,s<r&&(i=e,e=o,o=i,u=s,s=r,r=u),u=s+r,i=[];u--;i.push(0));for(f=r-1;f>-1;f--){for(r=0,u=s+f;u>f;r=i[u]+o[f]*e[u-f-1]+r,i[u--]=r%10|0,r=r/10|0);r&&(i[u]=(i[u]+r)%10)}for(r&&++n.e,i[0]||i.shift(),u=i.length;!i[--u];i.pop());return n.c=i,n};i.toString=i.valueOf=i.toJSON=function(){var r=this,t=r.e,n=r.c.join(""),i=n.length;if(t<=f||t>=e)n=n.charAt(0)+(i>1?"."+n.slice(1):"")+(t<0?"e":"e+")+t;else if(t<0){for(;++t;n="0"+n);n="0."+n}else if(t>0)if(++t>i)for(t-=i;t--;n+="0");else t<i&&(n=n.slice(0,t)+"."+n.slice(t));else i>1&&(n=n.charAt(0)+"."+n.slice(1));return r.s<0&&r.c[0]?"-"+n:n};i.toExponential=function(n){return n==null?n=this.c.length-1:(n!==~~n||n<0||n>u)&&r("!toExp!"),h(this,n,1)};i.toFixed=function(n){var t,i=this,o=f,s=e;return f=-(e=1/0),n==null?t=i.toString():n===~~n&&n>=0&&n<=u&&(t=h(i,i.e+n),i.s<0&&i.c[0]&&t.indexOf("-")<0&&(t="-"+t)),f=o,e=s,t||r("!toFix!"),t};i.toPrecision=function(n){return n==null?this.toString():((n!==~~n||n<1||n>u)&&r("!toPre!"),h(this,n-1,2))};Big=t;})()
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
			self.onRemoteJson(option.reportUri + "url=" + encodeURIComponent(option.dataUri) + "&st=" + params.st + "&et=" + params.et + "",function(data){
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
				onData({st: st, et: st + 14400}, function (data) {
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
		onCurrentInstability: function (callback, now) {
			function calcC(m, n) {
				var list = [], p = 1.0, np;
				for (var i = 0; i <= n - m - 1; i++) {
					np = p * (n - i) / (i + 1);
					if (isNaN(np) || np === Infinity) {
						list.push(p);
						p = (n - i) / (i + 1)
					}
					else {
						p = np;
					}
				}
				list.push(p);
				var p = new Big(list[0]);
				for (var i = list.length - 1; i > 0; i--) {
					p = p.times(list[i]);
				}
				return p;
			}

			function log2(p) {
				var result = 0;
				while (p.gte(Number.MAX_VALUE)) {
					result += 16;
					p = p.div(1 << 16);
				}
				return result + Math.log(p) / Math.log(2);
			}

			function cmp(m, n) {
				if (m < n) {
					return cmp(n, m);
				}
				if (m > 1000) {
					return m / 1000 * cmp(1000, Math.round(n / m * 1000));
				}
				var p1 = calcC(n, m * 2).div(2);
				while ((--n) >= 0) {
					p1 = p1.plus(calcC(n, m * 2));
				}
				return m * 2 - 1 - log2(p1);
			}

			var self = this;
			//请求24小时内的数据
			now = Math.ceil((now || new Date()) / 1000);
			self.onDatumMap(function (datumMap) {
				self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400, et: Math.ceil(now / 600) * 600}, function (data) {
					self.onBufferData({st: Math.ceil(now / 600) * 600 - 86400 * 2, et: Math.ceil(now / 600) * 600 - 86400}, function (historyData) {
						function createItem() {
							return {
								current: {totalNum: 0, hitsNum: 0},
								pre10Minutes: {totalNum: 0, hitsNum: 0},
								pre24Hours: {totalNum: 0, hitsNum: 0},
								currentHistory: {totalNum: 0, hitsNum: 0},
								pre10MinutesHistory: {totalNum: 0, hitsNum: 0},
								pre24HoursHistory: {totalNum: 0, hitsNum: 0}
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
							items[key].datumName = datumName;
							var instability = [], totalInstability = 0, unit = 0.1;
							//计算和基准点之间的不稳定性
							var datumName = key.indexOf("|") > 0 ? key.substring(0, key.indexOf("|")) : datumMap[key];
							if (datumName && items[datumName] && items[datumName].pre24Hours.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[datumName].current.totalNum * items[key].pre24Hours.totalNum / items[datumName].pre24Hours.totalNum * (data.maxTime % 600) / 600;
								var hitsNumExpect = totalNumExpect / (items[key].current.totalNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].current.hitsNum) {
									instability.push({desc: '当前数据(' + items[key].current.hitsNum + ')<>基准(' + Math.round(hitsNumExpect) + ')', value: cmp(hitsNumExpect, items[key].current.hitsNum)});
									totalInstability += instability[instability.length - 1].value;
								}
							}
							if (datumName && items[datumName] && items[datumName].pre24Hours.totalNum && items[key].pre24Hours.totalNum) {//计算上十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[datumName].pre10Minutes.totalNum * items[key].pre24Hours.totalNum / items[datumName].pre24Hours.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.totalNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum) {
									instability.push({desc: '前十分钟(' + items[key].pre10Minutes.hitsNum + ')<>基准(' + Math.round(hitsNumExpect) + ')', value: cmp(hitsNumExpect, items[key].pre10Minutes.hitsNum)});
									totalInstability += instability[instability.length - 1].value;
								}
							}
							if (items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[key].currentHistory.totalNum * items[key].pre24Hours.totalNum / items[key].pre24HoursHistory.totalNum * (data.maxTime % 600) / 600;
								var hitsNumExpect = totalNumExpect / (items[key].current.totalNum ? items[key].current.totalNum / items[key].current.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].current.hitsNum) {
									instability.push({desc: '当前数据(' + items[key].current.hitsNum + ')<>历史(' + Math.round(hitsNumExpect) + ')', value: cmp(hitsNumExpect, items[key].current.hitsNum)});
									totalInstability += instability[instability.length - 1].value;
								}
							}
							if (items[key].pre24HoursHistory.totalNum && items[key].pre24Hours.totalNum) {//计算当前不足十分钟内数据和基准对比的不稳定性
								var totalNumExpect = items[key].pre10MinutesHistory.totalNum * items[key].pre24Hours.totalNum / items[key].pre24HoursHistory.totalNum;
								var hitsNumExpect = totalNumExpect / (items[key].pre10Minutes.totalNum ? items[key].pre10Minutes.totalNum / items[key].pre10Minutes.hitsNum : items[key].pre24Hours.totalNum / items[key].pre24Hours.hitsNum);
								if (Math.round(hitsNumExpect) != items[key].pre10Minutes.hitsNum) {
									instability.push({desc: '前十分钟(' + items[key].pre10Minutes.hitsNum + ')<>历史(' + Math.round(hitsNumExpect) + ')', value: cmp(hitsNumExpect, items[key].pre10Minutes.hitsNum)});
									totalInstability += instability[instability.length - 1].value;
								}
							}
							instability.sort(function (a, b) {
								return b.value - a.value;
							});
							items[key].instability = instability;
							//不稳定性计算算法，主要以做最不稳定的数值为基准，其他的按照名次依次减权
							var instabilityNum = 0, unit = 1;
							for (var i = 0; i < instability.length; i++) {
								instabilityNum += instability[i].value * unit;
								unit = unit / 2;
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
		},
		getSubVersionData:function(data,version){
			if(!data || !version){return data;}
			var subData={maxTime:data.maxTime,minTime:data.minTime};
			for(var key in data){
				var val = data[key];
				if(!val || !val.totalNum){continue;}
				if(key.indexOf(version+"|")===0)
				{
					subData[key]=val;
				}
			}
			return subData;
		},
		getDataSummary:function(data){
			var summary={
				totalNum: 0,
				hitsNum: 0
			};
			for(var key in data){
				var val = data[key];
				if(!val || !val.totalNum){continue;}
				summary.totalNum+=val.totalNum;
				summary.hitsNum+=val.hitsNum;
			}
			return summary;
		},
		getDataVersionMap:function(data){
			var versionMap={};
			//划分版本数据
			for(var key in data){
				var val= data[key];
				if(!val || !val.totalNum){continue;}
				var versionResult=/^([\d\.]+)\|/.exec(key);
				if(versionResult)
				{
					var version=versionMap[versionResult[1]]||(versionMap[versionResult[1]]={
						totalNum:0,
						hitsNum:0,
						time:{},
						name:versionResult[1]
					});
					version.totalNum+=val.totalNum;
					version.hitsNum+=val.hitsNum;
					version.exampleURL=val.exampleURL;
					if (val.time) {
						for(var k in val.time){
							var v= val.time[k],
								v1 = version.time[k] || (version.time[k] = {
								totalNum: 0,
								hitsNum: 0
							});
							v1.totalNum += v.totalNum;
							v1.hitsNum += v.hitsNum;
							v1.exampleURL = v.exampleURL;
						}
					}
				}
			}
			return versionMap;
		},
		getDataVersionList:function(data){
			var versionMap = this.getDataVersionMap(data),
				versionList=[];
			for(var key in versionMap)
			{
				versionList.push(versionMap[key]);
			}
			versionList.sort(function(a,b){return b.totalNum- a.totalNum;});
			return versionList;
		}
	};
}