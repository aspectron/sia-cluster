//
//  Copyright (c) 2011-2013 ASPECTRON Inc.
//  All Rights Reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
// 
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
// 
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//


var _ = require("underscore"),
    spawn = require("child_process").spawn,
    irisUtils = require("iris-utils");

function Application() {
    var self = this;
    var args = process.argv.slice(2);

    self.process = { }
    _.each(args, function (name) {
        console.log(('loading: ' + name).bold);

        self.process[name] = new irisUtils.Process({
            process: process.execPath,
            args: [ name ],
            descr: name,
            logger: new irisUtils.Logger({ filename: __dirname + '/logs/' + name + '.log' })
        });
        self.process[name].run();
    })
}

global.app = new Application();