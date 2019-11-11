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

const Widget = require("$:/core/modules/widgets/widget.js").widget;

const InterServerMessage = function(parseTreeNode,options) {
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
  this.fieldList = this.getAttribute('fieldList', null);
  this.resolution = this.getAttribute('resolution', 'manual');
  this.noPreview = this.getAttribute('noPreview', 'false');
};

/*
Refresh the widget by ensuring our attributes are up to date
*/
InterServerMessage.prototype.refresh = function(changedTiddlers) {
	const changedAttributes = this.computeAttributes();
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
  const self = this;
  const serverURL = this.url
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
  } else if (this.requestType === 'pushPlugin') {
    self.url += '/api/plugins/upload'
  }
  // make the xmlhttprequest object
  const xhr = new XMLHttpRequest()
  // setup request object
  xhr.open('POST', self.url, true)
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
  // set the onload function
  xhr.onload = function () {
    // do something to response
    if (this.responseText && this.status == "200") {
      // handle the response!
      try {
        const responseData = JSON.parse(this.responseText)
        if (self.requestType === 'fetch') {
          Object.keys(responseData.tiddlers).forEach(function(title) {
            // Fix the modified and created fields, otherwise they are just NAN
            responseData.tiddlers[title].fields.modified = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.modified));
            responseData.tiddlers[title].fields.created = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.created));
            // If we have a transform filter apply it to the titles
            const tiddler = responseData.tiddlers[title];
            let newTitle = undefined;
            if (self.transformFilter) {
              newTitle = ($tw.wiki.filterTiddlers(self.transformFilter,null,new $tw.Tiddler(tiddler)) || [""])[0];
            }
            // Add the tiddler using the desired conflict resolution method
            if (newTitle) {
              if (self.resolution === 'force') {
                // Don't do anything about the title
              } else if (self.resolution === 'conflict') {
                // If the tiddler exists already than change the title
                if ($tw.wiki.tiddlerExists(newTitle)) {
                  newTitle = '$:/state/TWederBob/Import/' + newTitle;
                }
              } else {
                newTitle = '$:/state/TWederBob/Import/' + newTitle;
              }
              $tw.wiki.importTiddler(new $tw.Tiddler(tiddler.fields, {title: newTitle}))
            }
            // Save the list of imported tiddlers
            const fields = {
              title: "$:/state/TWederBob/importlist",
              text: JSON.stringify(responseData.info, null, 2),
              list: $tw.utils.stringifyList(responseData.list),
              type: 'application/json'
            }
            $tw.wiki.addTiddler(new $tw.Tiddler(fields))
            if (self.noPreview !== 'true') {
              // we have conflicts so open the conflict list tiddler
              let storyList = $tw.wiki.getTiddler('$:/StoryList').fields.list
              storyList = "$:/plugins/TWederBob/ImportList " + $tw.utils.stringifyList(storyList)
              $tw.wiki.addTiddler({title: "$:/StoryList", text: "", list: storyList},$tw.wiki.getModificationFields());
            }
          })
        } else if (self.requestType === 'fetchList') {
          let fields = {
            title: "$:/state/TWederBob/importlist",
            text: JSON.stringify(responseData.info, null, 2),
            list: $tw.utils.stringifyList(responseData.list),
            type: 'application/json'
          }
          $tw.wiki.addTiddler(new $tw.Tiddler(fields))
          Object.keys(responseData.info).forEach(function(tidTitle) {
            fields = {}
            Object.keys(responseData.info[tidTitle]).forEach(function(field) {
              if (field !== 'modified' && field !== 'created' && field !== 'tags') {
                fields[field] = responseData.info[tidTitle][field]
              } else {
                const newName = 'import_' + field
                fields[newName] = responseData.info[tidTitle][field]
              }
              fields.title = '$:/state/ImportList/' + tidTitle
              fields.tags = '[[Import Info]]'
              fields.import_wiki = self.fromWiki
              fields.import_server = serverURL
            })
            $tw.wiki.addTiddler(new $tw.Tiddler(fields))
          })
        } else if (self.requestType === 'listPlugins') {
          responseData.forEach(function(pluginData) {
            const fields = {
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
        console.log('Can\'t parse response!', e)
      }
    }
  }
  // Make post body
  const token = localStorage.getItem(this.tokenKey);
  let postString = {
    'type': this.requestType,
    'token': token
  }
  if (this.toWiki) {
    const list = $tw.wiki.filterTiddlers(this.filter);
    const tiddlers = []
    list.forEach(function(title) {
      tiddlers.push($tw.wiki.getTiddler(title))
    })
    postString['toWiki'] = this.toWiki;
    postString['tiddlers'] = tiddlers;
  } else if (this.fromWiki) {
    postString['filter'] = this.filter;
    postString['fromWiki'] = this.fromWiki;
    postString['fieldList'] = this.fieldList;
  } else if (this.pluginName) {
    const plugin = $tw.wiki.getTiddler(this.pluginName)
    if (plugin) {
      postString['plugin'] = plugin;
    }
  }
  postString = JSON.stringify(postString)
  // send request
  xhr.send('message='+postString);
  return true;
};

exports["action-interServerMessage"] = InterServerMessage;

})();
