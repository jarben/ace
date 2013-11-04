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
var TextMode = require("./text").Mode;
var Tokenizer = require("../tokenizer").Tokenizer;
var XmlHighlightRules = require("./xml_highlight_rules").XmlHighlightRules;
var XmlBehaviour = require("./behaviour/xml").XmlBehaviour;
var XmlFoldMode = require("./folding/xml").FoldMode;
var WorkerClient = require("../worker/worker_client").WorkerClient;
var EventEmitter = require("../lib/event_emitter").EventEmitter;


var Mode = function() {
    this.HighlightRules = XmlHighlightRules;
    this.$behaviour = new XmlBehaviour();
    this.foldingRules = new XmlFoldMode();
};

oop.inherits(Mode, TextMode);

(function() {
    
    this.blockComment = {start: "<!--", end: "-->"};
    
    var me = this; 
    this.createWorker = function(session) {
        var worker = new WorkerClient(["ace"], "ace/mode/aviarc-xml_worker", "AviarcXMLWorker");
        worker.attachToDocument(session.getDocument());

        worker.on("requestForTokens", function(e) {
            // Read all the tokens in the session
            var tokens = [];
            for(var row = 0; row < session.getLength(); row++) {
                var col = 0;
                var lineTokens = session.getTokens(row);
        
                for(var i = 0; i < lineTokens.length; i++) {
                    // Take the token
                    var token = lineTokens[i];
        
                    // Save its row and col
                    token.lineRow = row;
                    token.lineCol = col;
                    col += token.value.length;
                    
                    // Add it to the list of all tokens
                    tokens.push(token);
                }
            }
            worker.$worker.postMessage({command: "parseTokens", args: [tokens]});
        });
        
        
        worker.on("parse", function(result) {
            session._emit("parse", result.data);
        });

        return worker;
    };

}).call(Mode.prototype);

exports.Mode = Mode;
});
