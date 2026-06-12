(function(s,o,u){"use strict";const l=o.findByStoreName("UserStore"),f=o.findByStoreName("UserProfileStore"),c=o.findByStoreName("PresenceStore"),p=o.findByStoreName("NoteStore");let r=[];function d(i){if(!p)return null;const e=p.getNote(i);if(!e||!e.startsWith("override::"))return null;const t=e.slice(10).split("|").map(function(n){return n.trim()});return{displayName:t[0]||null,bio:t[1]||null,pfp:t[2]||null,status:t[3]||null}}var m={onLoad:function(){l&&typeof l.getUser=="function"&&r.push(u.after("getUser",l,function(i,e){if(!e||!e.id)return e;const t=d(e.id);return t&&(t.displayName&&(e.globalName=t.displayName),t.pfp&&(e.avatar=t.pfp,e.getAvatarURL)&&(e.getAvatarURL.bind(e),e.getAvatarURL=function(...n){return t.pfp})),e})),f&&typeof f.getUserProfile=="function"&&r.push(u.after("getUserProfile",f,function(i,e){if(!e)return e;const t=i[0],n=d(t);return!n||!n.bio||(e.bio=n.bio),e})),c&&typeof c.getPresence=="function"&&r.push(u.after("getPresence",c,function(i,e){const t=i[0],n=d(t);if(!n||!n.status)return e;e||(e={activities:[]}),e.activities||(e.activities=[]);let a=e.activities.find(function(g){return g.type===4});return a||(a={type:4,name:"Custom Status",id:"custom"},e.activities.push(a)),a.state=n.status,e}))},onUnload:function(){for(const i of r)try{i()}catch{}r=[]},settings:function(){return React.createElement(ReactNative.View,{style:{flex:1,padding:20,backgroundColor:"#1e1f22"}},React.createElement(ReactNative.Text,{style:{color:"#dcddde",fontSize:18,fontWeight:"bold",marginBottom:16}},"FakeProfile"),React.createElement(ReactNative.Text,{style:{color:"#b9bbbe",fontSize:14,lineHeight:22}},`Add a note to any user with this format:

override::Display Name|Bio text here|https://image.url|Custom status

Example:
override::Cool Name|Hello world|https://i.imgur.com/abc.png|Playing games

Leave fields empty if not needed:
override::|Bio only||

All changes are client-side only.`))}};return s.default=m,Object.defineProperty(s,"__esModule",{value:!0}),s})({},vendetta.metro,vendetta.patcher);
