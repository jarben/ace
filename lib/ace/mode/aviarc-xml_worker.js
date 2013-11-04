/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;

var AviarcXMLWorker = exports.AviarcXMLWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(500);
    this.setOptions();
};

oop.inherits(AviarcXMLWorker, Mirror);

(function() {
    this.setOptions = function(options) {
        this.options = options || {};
        this.doc.getValue() && this.deferredUpdate.schedule(100);
    };

    this.changeOptions = function(newOptions) {
        oop.mixin(this.options, newOptions);
        this.doc.getValue() && this.deferredUpdate.schedule(100);
    };

    /* Output:
    {
        name: "container",
        value: "some text",
        attributes:[
        	{name:"id", value="123", range: {...}}
    	],
    	range: {startRow: 0, startCol:0,
    			endRow: 0, endCol:0},
    	children: [
    		...
    	]
    }
    */
    
    
    // x = new XMLToJsonConverter();
    // x.convertSession(myACEEditor.session));
    var XMLToJsonConverter = function() {
    };
    
    XMLToJsonConverter.prototype.convertTokens = function(tokens) {
        var tokensItr = new ArrayIterator(tokens);
        return this._convertTokens(tokensItr);
    };
    
    XMLToJsonConverter.prototype._convertTokens = function(tokens) {
        // Create the initial, empty, JSON structure.
        var jsonRoot= this._createEmptyJSONElement();
    
        if(!tokens)
            return jsonRoot; // Return something friendly
    
        var jsonStack = [];
        var currentJson = null; // Always the top of the stack
    
        // Loop through tokens in the current line
        while(tokens.hasNext()) {
            // Here, we treat the tokens as a stack, popping off each successive XML token.
            var token = tokens.next();

            if(token.type == 'meta.tag.punctuation.begin' && token.value == '<') {
                var newElement = this._parseElement(tokens);
                if(currentJson) {
                    // Add the new XML element as a child of the current XML element
                    currentJson.children.push(newElement);
                    jsonStack.push(newElement);
                }else{
                    // This is the root XML element
                    currentJson = newElement;
                    jsonStack.push(currentJson);
                    jsonRoot = currentJson;
                }
                // Update the current JSON element to the top of the stack
                currentJson = jsonStack[jsonStack.length - 1];
            }else if(token.type == 'text') {
                // Add text values such as <tagname> text values here </tagname>
                if(currentJson && token.value.trim().length > 0) {
                    currentJson.value = token.value.trim();
                }
            }else if(token.type == 'entity.other.attribute-name') {
                // Add the new XML attribute to the current XML element
                currentJson.attributes.push(this._parseAttribute(tokens));
            }else if(token.type == 'meta.tag.punctuation.begin' && token.value == '</') {
                // We have finished with the current element
                this._parseClosingElement(tokens, currentJson);
                jsonStack.pop();
                currentJson = jsonStack[jsonStack.length - 1];
            }else if(token.type == 'meta.tag.punctuation.end' && token.value == '/>') {
                // We have finished with the current element
                var json = (currentJson) ? currentJson : jsonRoot;
                json.range.endRow = token.lineRow;
                json.range.endCol = token.lineCol + token.value.length;
    
                jsonStack.pop();
                currentJson = jsonStack[jsonStack.length - 1];
            }else{
                // Ignore this token
                //console.log('Ignoring token: ' + token.type);
            }
        }
    
        return jsonRoot;
    };
    
    XMLToJsonConverter.prototype._skipUntill = function(tokens, tokenType) {
        while(tokens.hasNext() && tokens.peek().type != tokenType) {
            tokens.next();
        }
    };
    
    
    XMLToJsonConverter.prototype._parseElement = function(tokens) {
        var json= this._createEmptyJSONElement();
    
        json.range.startRow = tokens.peek().lineRow;
        json.range.startCol = tokens.peek().lineCol;
        this._skipUntill(tokens, 'meta.tag.name');
    
        json.name = tokens.peek().value;
    
        return json;
    };
    
    XMLToJsonConverter.prototype._parseAttribute = function(tokens) {
        var json = {
            name: '',
            value: '',
            range: {startRow: tokens.peek().lineRow,
                     startCol: tokens.peek().lineCol,
                     endRow: -1,
                     endCol: -1},
        };
    
        if(tokens.hasNext()) {
            json.name = tokens.peek().value;
            
            tokens.next();
            
            while(tokens.hasNext() 
                    && tokens.peek().type != 'string' 
                    && tokens.peek().type != 'meta.tag.punctuation.end'
                    && tokens.peek().type != 'entity.other.attribute-name') {
                tokens.next();
            }
            
            if (tokens.peek().type == 'string'){
                json.value = tokens.peek().value;
                json.value = json.value.substring(1, json.value.length - 1);
            } else {
                json.value = null;
            }
            json.range.endRow = tokens.peek().lineRow;
            json.range.endCol = tokens.peek().lineCol + tokens.peek().value.length;
        }
    
        return json;
    };
    
    XMLToJsonConverter.prototype._parseClosingElement = function(tokens, json) {
        tokens.next();
        this._skipUntill(tokens, 'meta.tag.punctuation.end');
        
        var token = tokens.peek();
        if (json){
            json.range.endRow = token.lineRow;
            json.range.endCol = token.lineCol + token.value.length;
        }
    };
    
    XMLToJsonConverter.prototype._createEmptyJSONElement = function() {
        var json= {
            name: '',
            value: '',
            attributes: [],
            range: {startRow: -1,
                     startCol: -1,
                     endRow: -1,
                     endCol: -1},
            children: []
        };
    
        return json;
    };
    
    /** A simple iterator over a standard array.
     * @constructor
     * @param {array} array JavaScript array.
     */
    var ArrayIterator = function(array) {
        this._array = array;
        this._index = -1;
    };
    
    /** Increments the iterator to the next value.
     * @returns The next value or false if there are no more values.
     */
    ArrayIterator.prototype.next = function() {
        var result = false;
    
        if(this.hasNext()) {
            result = this._array[++this._index];
        }
    
        return result;
    };
    
    /** Gets the current value.
     * @returns The current value.
     */
    ArrayIterator.prototype.peek = function() {
        return this._array[this._index];
    };
    
    /** Checks if there is a next value.
     * @returns {boolean} True if calling next() will return the next value. False if there are no further values.
     */
    ArrayIterator.prototype.hasNext = function() {
        return this._index + 1 < this._array.length;
    };
    
    var xmlParser = new XMLToJsonConverter();
    
    this.onUpdate = function() {
        this.sender.emit("requestForTokens");
    };
    
    this.parseTokens = function(tokens) {
        var jsonResult = xmlParser.convertTokens(tokens);
        this.sender.emit("parse", jsonResult);
    };
}).call(AviarcXMLWorker.prototype);

});
