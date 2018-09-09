/*\
title: $:/plugins/OokTech/TWederBob/action-interServerMessage.js
type: application/javascript
module-type: widget

Action widget that queries a server for a list of tiddlers that match a filter.

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var InterServerMessage = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
InterServerMessage.prototype = new Widget();

/*
Render this widget into the DOM
*/
InterServerMessage.prototype.render = function(parent,nextSibling) {
	this.computeAttributes();
	this.execute();
};

/*
Compute the internal state of the widget
*/
InterServerMessage.prototype.execute = function() {
	this.url = this.getAttribute('url');
  this.filter = this.getAttribute('filter');
  this.requestType = this.getAttribute('requestType', 'fetch');
  this.fromWiki = this.getAttribute('fromWiki', 'RootWiki');
  this.toWiki = this.getAttribute('toWiki', null);
  this.tokenKey = this.getAttribute('tokenKey', null);
  this.transfromFilter = this.getAttribute('transfromFilter', null);
  this.pluginName = this.getAttribute('pluginName', null);
};

/*
Refresh the widget by ensuring our attributes are up to date
*/
InterServerMessage.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(Object.keys(changedAttributes).length) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

/*
Invoke the action associated with this widget
*/
InterServerMessage.prototype.invokeAction = function(triggeringWidget,event) {
  var self = this;
  if (self.url.slice(-1) === '/') {
    self.url = self.url.slice(-1);
  }
  if (this.requestType === 'fetch') {
    self.url += '/api/fetch'
  } else if (this.requestType === 'fetchList') {
    self.url += '/api/fetch/list'
  } else if (this.requestType === 'push') {
    self.url += '/api/push'
  } else if (this.requestType === 'listPlugins') {
    self.url += '/api/plugins/list'
  } else if (this.requestType === 'fetchPlugin') {
    self.url += '/api/plugins/fetch/'+this.pluginName
  }
  // make the xmlhttprequest object
  var xhr = new XMLHttpRequest()
  // setup request object
  xhr.open('POST', self.url, true)
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
  // set the onload function
  xhr.onload = function () {
    // do something to response
    if (this.responseText && this.status == "200") {
      // handle the response!
      try {
        var responseData = JSON.parse(this.responseText)
        if (self.requestType === 'fetch') {
          Object.keys(responseData.tiddlers).forEach(function(title) {
            // Fix the modified and created fields, otherwise they are just NAN
            responseData.tiddlers[title].fields.modified = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.modified));
            responseData.tiddlers[title].fields.created = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.created));
            // If we have a transform filter apply it to the titles
            if (self.transformFilter) {
              var transformedTitle = ($tw.wiki.filterTiddlers(self.transformFilter,null,new $tw.Tiddler(responseData.tiddlers[title])) || [""])[0];
      				if(transformedTitle) {
      					$tw.wiki.addTiddler(new $tw.Tiddler(tiddler,{title: transformedTitle}));
      				}
            } else {
              $tw.wiki.importTiddler(new $tw.Tiddler(responseData.tiddlers[title].fields))
              var fields = {
                title: "$:/state/TWederBob/importlist",
                text: responseData.list
              }
              $tw.wiki.addTiddler(new $tw.Tiddler(fields))
            }
          })
        } else if (self.requestType === 'fetchList') {
          var fields = {
            title: "$:/state/TWederBob/importlist",
            list: $tw.utils.stringifyList(responseData.list)
          }
          $tw.wiki.addTiddler(new $tw.Tiddler(fields))
        } else if (self.requestType === 'listPlugins') {
          responseData.forEach(function(pluginData) {
            var fields = {
              title: '$:/pluginData/Listing/'+pluginData.tiddlerName,
              name: pluginData.name,
              description: pluginData.description,
              tiddler_name: pluginData.tiddlerName,
              version: pluginData.version,
              author: pluginData.author,
              text: pluginData.readme
            }
            $tw.wiki.importTiddler(new $tw.Tiddler(fields))
          })
        } else if (self.requestType === 'fetchPlugin') {
          $tw.wiki.addTiddler(new $tw.Tiddler(responseData))
        }
      } catch (e) {
        console.log('Can\'t parse response!')
      }
    }
  }
  // Make post body
  var token = localStorage.getItem(this.tokenKey);
  var postString = {
    'type': this.requestType,
    'token': token
  }
  if (this.toWiki) {
    var list = $tw.wiki.filterTiddlers(this.filter);
    var tiddlers = []
    list.forEach(function(title) {
      tiddlers.push($tw.wiki.getTiddler(title))
    })
    postString['toWiki'] = this.toWiki;
    postString['tiddlers'] = tiddlers;
  } else {
    postString['filter'] = this.filter;
    postString['fromWiki'] = this.fromWiki;
  }
  postString = JSON.stringify(postString)
  // send request
  xhr.send('message='+postString);
  return true;
};

exports["action-interServerMessage"] = InterServerMessage;

})();
