function testUi(useConsole) {
    this.controls = new uiControls();
    this.console = $("#console");

    this.useConsole = (useConsole === undefined) ? false : useConsole;

    var header = '<div class="ui-widget-header ui-corner-all"></div>';
    var codeBlock = '<div id="code"><button id="code-button" class="button test-element">Показать код</button>' + '<div id="code-view"><pre class = "brush: js"></pre></div></div>';
    var runButton = '<button id="test-run" class="button test-element">Запустить тест</button>';

    $(".test").each(function (index) {
        if (!TestSuite[$(this).attr("id")]) return;
        var test = TestSuite[$(this).attr("id")];
        test.container = $(this);
        test.section = $(this).parent();

        $(this).html(header + codeBlock + $(this).html() + runButton);
        $(this).find(".ui-widget-header").text(test.description);

        $(this).find("#code-view > pre").text(test.runTest.toString());
        $(this).find("#test-run").click($.proxy(test.run, test));

        var code = $(this).find("#code");
        code.find("#code-button").toggle(function () {
            code.find("#code-view").show("Blind");
        }, function () {
            code.find("#code-view").hide("Blind");
        });
    });

    $(".button").button();
    SyntaxHighlighter.all();

    $("#section").tabs({
        select: function () {
            ui.console.empty();
        }
    });
}

function uiControls() {
    this.deviceList = $("#device-list");
    this.certificateList = $("#cert-list");

    this.refreshDeviceListButton = $("#refresh-dev");
    this.refreshCertificateListButton = $("#refresh-certs");
}

uiControls.prototype = {
    deviceList: null,
    keyList: null,
    certificateList: null,

    refreshDeviceListButton: null,
    refreshKeyListButton: null,
    refreshCertificateListButton: null,
};

testUi.prototype = {
    controls: null,
    console: null,
    useConsole: null,

    clear: function () {
        this.console.empty();
    },
    write: function (text) {
        var str = text.replace(/\n/g, "<br>");
        this.console.html(this.console.html() + str);
        this.console.scrollTop(this.console[0].scrollHeight);
    },
    writeln: function (text) {
        this.write(text + "\n");
    },

    useCSS: function () {
        return $("#use-css").is(':checked');
    },

    css: function () {
        return $("#dialog-css").val();
    },

    device: function () {
        var deviceId = Number(this.controls.deviceList.val());
        if (isNaN(deviceId)) throw "Нет доступных устройств";
        return deviceId;
    },

    certificate: function () {
        if (this.controls.certificateList.val() == null) throw "Сертификат не выбран";
        return this.controls.certificateList.val();
    },

    addDevice: function (label) {
        ui.controls.deviceList.append($("<option>", {
            'value': label
        }).text(label));
    },

    clearDeviceList: function (message) {
        this.controls.deviceList.empty();
        if (message) this.controls.deviceList.append($("<option>").text(message));
    },

    addCertificate: function (certificate) {
        this.controls.certificateList.append($("<option>", {
            'value': certificate,
            'title': certificate
        }).text(certificate));
    },

    clearCertificateList: function (message) {
        this.controls.certificateList.empty();
        if (message) this.controls.certificateList.append($("<option>").text(message));
    },

    getContent: function (container, index) {
        if (index === undefined)
            index = 0;
        var elements = container.find(".text-input, .input");
        return elements[index].value;
    },

    registerEvents: function () {
        this.controls.refreshDeviceListButton.click($.proxy(function () {
            try {
                plugin.enumerateDevices();
            } catch (error) {
                this.writeln(error.toString());
                this.clearDeviceList(error.toString());
            }
        }, this));

        this.controls.refreshCertificateListButton.click($.proxy(function () {
            try {
                plugin.enumerateCertificates();
            } catch (error) {
                this.writeln(error.toString());
                this.clearCertificateList(error.toString());
            }
        }, this));


        this.controls.deviceList.change($.proxy(function () {
            if (plugin.autoRefresh) {
                plugin.enumerateCertificates();
            } else {
                this.clearCertificateList("Обновите список контейнеров");
            }
        }, this));
    },

    printError: function (code) {
        if (this.useConsole) {
            console.trace();
            //console.log(code);
            console.debug(arguments);
        }
        this.writeln("Ошибка: " + plugin.errorDescription[code] + "\n");
    },

    printResult: function (message) {
        if (this.useConsole) {
            console.trace();
            console.debug(arguments);
        }
        if (undefined === message) {
            this.writeln("Выполнен" + "\n");
            return;
        }
        if ($.isArray(message)) {
            if (message.length) this.writeln("Массив длиной(" + message.length + "): \n" + message.join("\n") + "\n");
            else this.writeln("<Пустой массив>");
            return;
        }
        if (Object.prototype.toString.call(message) === '[object Object]') {
            this.writeln(JSON.stringify(message, null, "\t") + "\n");
            return;
        }
        if (message === "") {
            this.writeln("<Пустая строка>" + "\n");
            return;
        }
        this.writeln(message + "\n");
    },
}

function timedCallbackProxy(func, name) {
    return function() {
        console.timeEnd(name);
        func.apply(this, arguments);
    };
}

function timedProxy(pluginObject, name) {
    return function() {
        console.time(name);
        arguments[arguments.length - 2] = timedCallbackProxy(arguments[arguments.length - 2], name);
        arguments[arguments.length - 1] = timedCallbackProxy(arguments[arguments.length - 1], name);
        pluginObject[name].apply(pluginObject, arguments);
    };
}

function cryptoPlugin(pluginObject, noAutoRefresh) {
    this.autoRefresh = noAutoRefresh ? false : true;

    this.pluginObject = pluginObject;
    if (!this.pluginObject.valid) this.delayedReport("Error: couldn't get CryptopluginObject");

    for (var key in this.pluginObject) {
        if (this[key]) continue;

        if (typeof(this.pluginObject[key]) == "function") this[key] = timedProxy(this.pluginObject, key);
        else this[key] = this.pluginObject[key];
    }

    ui.printResult("Рутокен Web Плагин v." + this.pluginObject.version);

    this.errorDescription = {
        "-1": "USB-токен не найден",
        "-2": "USB-токен не залогинен пользователем",
        "-3": "PIN-код не верен",
        "-4": "PIN-код не корректен",
        "-5": "PIN-код заблокирован",
        "-6": "Неправильная длина PIN-кода",
        "-7": "Отказ от ввода PIN-кода",
        "-10": "Неправильные аргументы функции",
        "-11": "Неправильная длина аргументов функции",
        "-12": "Открыто другое окно ввода PIN-кода",
        "-20": "Контейнер не найден",
        "-21": "Контейнер уже существует",
        "-22": "Контейнер поврежден",
        "-30": "ЭЦП не верна",
        "-40": "Не хватает свободной памяти чтобы завершить операцию",
        "-50": "Библиотека не загружена",
        "-51": "Библиотека находится в неинициализированном состоянии",
        "-52": "Библиотека не поддерживает расширенный интерфейс",
        "-53": "Ошибка в библиотеке rtpkcs11ecp"
    };

    if (this.autoRefresh) this.enumerateDevices();
}

cryptoPlugin.prototype = {
    pluginObject: null,
    errorCodes: null,
    errorDescription: [],
    methods: null,
    constants: null,
    autoRefresh: null,

    delayedReport: function (message) {
        setTimeout(function () {
            ui.writeln(message + "\n");
        }, 0);
    },

    enumerateDevices: function () {
        ui.clearDeviceList("Список устройств обновляется...");
        this.pluginObject.rtwIsTokenPresentAndOK($.proxy(function (result) {
            if (result != true) {
                ui.clearDeviceList("Нет доступных устройств");
                ui.clearCertificateList("Нет доступных устройств");
                return;
            }
            ui.clearDeviceList();

            this.pluginObject.rtwGetDeviceID($.proxy(function (sn) {
                    ui.addDevice(sn);
                }, this), $.proxy(ui.printError, ui));

            if (this.autoRefresh) this.enumerateCertificates();
            else ui.clearCertificateList("Обновите список сертификатов");
        }, this), $.proxy(ui.printError, ui));
    },

    enumerateCertificates: function () {
        function onError(errorCode) {
            $.proxy(ui.printError, ui)(errorCode);
            ui.clearCertificateList("Произошла ошибка");
        }

        ui.clearCertificateList("Список сертификатов обновляется...");

        try {
            this.pluginObject.rtwGetNumberOfContainers($.proxy(function(count) {
                if (count == 0)
                    ui.clearCertificateList("Обновите список сертификатов");
                for (i = 0; i < count; i++) {
                    if (i == 0)
                        ui.clearCertificateList();
                    this.pluginObject.rtwGetContainerName(i, $.proxy(function(name) {
                         ui.addCertificate(name);
                    }, this), onError);
                }
            }, this), onError);
        } catch (e) {
            // ui now throws an exception if there is no devices avalable
            console.log(e);
        }
    }
}

// ts begin
var TestSuite = new(function () {

    function Test() {
        this.run = function () {
            ui.writeln(this.description() + ":");
            try {
                this.runTest();
            } catch (e) {
                ui.writeln(e + "\n");
            }
        }
    };

    this.pluginVersion = new(function () {
        Test.call(this);
        this.description = function () {
            return "Plugin version";
        };
        this.runTest = function () {
                function successCallback(result) {
                    ui.printResult(result);
                }
            plugin.get_version(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.IsTokenPresentAndOK = new(function () {
        Test.call(this);
        this.description = function () {
            return "Rutoken present and ok";
        };
        this.runTest = function () {
                function successCallback(result) {
                    if(result < 0)
                        result = plugin.errorDescription[result]
                    ui.printResult(result);
                }
            plugin.rtwIsTokenPresentAndOK(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.GetDeviceID = new(function () {
        Test.call(this);
        this.description = function () {
            return "Device Id";
        };
        this.runTest = function () {
                function successCallback(result) {
                    ui.printResult(result);
                }
            plugin.rtwGetDeviceID(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.GetNumberOfContainers = new(function () {
        Test.call(this);
        this.description = function () {
            return "Number of containers";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            plugin.rtwGetNumberOfContainers(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.GenKeyPair = new(function () {
        Test.call(this);
        this.description = function () {
            return "Генерация ключевой пары";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
                if (plugin.autoRefresh) plugin.enumerateCertificates();
                else ui.clearKeyList("Обновите список контейнеров");
            }
            if(ui.useCSS()) {
                plugin.rtwGenKeyPair(ui.getContent(this.container, 0), ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwGenKeyPair(ui.getContent(this.container, 0), undefined, successCallback, $.proxy(ui.printError, ui));
            }
        }
    })();

    this.GetContainerName = new(function () {
        Test.call(this);
        this.description = function () {
            return "Имя контейнера по индексу";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            plugin.rtwGetContainerName(ui.getContent(this.container, 0), successCallback, $.proxy(ui.printError, ui));
        }
    })();

    this.GetPublicKey = new(function () {
        Test.call(this);
        this.description = function () {
            return "Публичный ключ в контейнере";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            plugin.rtwGetPublicKey(ui.certificate(), successCallback, $.proxy(ui.printError, ui));
        }
    })();

    this.GetRepairKey = new(function () {
        Test.call(this);
        this.description = function () {
            return "Ключ восстановления";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            plugin.rtwGetPublicKey('repair key', successCallback, $.proxy(ui.printError, ui));
        }
    })();

    this.DestroyContainer = new(function () {
        Test.call(this);
        this.description = function () {
            return "Удаление контейнера";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
                if (plugin.autoRefresh) plugin.enumerateCertificates();
                else ui.clearKeyList("Обновите список контейнеров");
            }

            if(ui.useCSS()) {
                plugin.rtwDestroyContainer(ui.certificate(), ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwDestroyContainer(ui.certificate(), undefined, successCallback, $.proxy(ui.printError, ui));
            }
        }
    })();

    this.Sign = new(function () {
        Test.call(this);
        this.description = function () {
            return "Подпись хеша";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            if(ui.useCSS()) {
                plugin.rtwSign(ui.certificate(), ui.getContent(this.container, 0), ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwSign(ui.certificate(), ui.getContent(this.container, 0), undefined, successCallback, $.proxy(ui.printError, ui));
            }
        }
    })();

    this.HashSign = new(function () {
        Test.call(this);
        this.description = function () {
            return "Подпись сообщения";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            if(ui.useCSS()) {
                plugin.rtwHashSign(ui.certificate(), ui.getContent(this.container, 0), ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwHashSign(ui.certificate(), ui.getContent(this.container, 0), undefined, successCallback, $.proxy(ui.printError, ui));
            }

        }
    })();

    this.MakeSessionKey = new(function () {
        Test.call(this);
        this.description = function () {
            return "Генерация сессионного ключа";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            if(ui.useCSS()) {
                plugin.rtwMakeSessionKey(ui.certificate(), ui.getContent(this.container, 1), ui.getContent(this.container, 0), ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwMakeSessionKey(ui.certificate(), ui.getContent(this.container, 1), ui.getContent(this.container, 0), undefined, successCallback, $.proxy(ui.printError, ui));
            }
        }
    })();

    this.Repair = new(function () {
        Test.call(this);
        this.description = function () {
            return "Repair";
        };
        this.runTest = function () {
            function successCallback(result) {
                ui.printResult(result);
            }
            plugin.rtwRepair(ui.getContent(this.container, 0), ui.getContent(this.container, 1), successCallback, $.proxy(ui.printError, ui));
        }
    })();

    this.UserLoginDlg = new(function () {
        Test.call(this);
        this.description = function () {
            return "Login Dialog [deprecated]";
        };
        this.runTest = function () {
            function successCallback(result) {
                if(result < 0)
                    result = plugin.errorDescription[result]
                ui.printResult(result);
            }

            if(ui.useCSS()) {
                plugin.rtwUserLoginDlg(ui.css(), successCallback, $.proxy(ui.printError, ui));
            } else {
                plugin.rtwUserLoginDlg(undefined, successCallback, $.proxy(ui.printError, ui));
            }
        };
    })();

    this.Logout = new(function () {
        Test.call(this);
        this.description = function () {
            return "Logout [deprecated]";
        };
        this.runTest = function () {
            function successCallback(result) {
                if(result < 0)
                        result = plugin.errorDescription[result]
                ui.printResult(result);
            }
            plugin.rtwLogout(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.IsUserLoggedIn = new(function () {
        Test.call(this);
        this.description = function () {
            return "IsUserLoggedIn [deprecated]";
        };
        this.runTest = function () {
            function successCallback(result) {
                if(result < 0)
                    result = plugin.errorDescription[result]
                ui.printResult(result);
            }
            plugin.rtwIsUserLoggedIn(successCallback, $.proxy(ui.printError, ui));
        };
    })();

    this.ParallelCall = new(function () {
        Test.call(this);
        this.description = function () {
            return "Parallel Call";
        };
        this.runTest = function () {
            function makeSuccessCallback(i) {
                return function(result) {
                    ui.printResult("("+i+") "+result);
                }
            }
            for (i=0; i<3; i++) {
                    plugin.rtwGetDeviceID(makeSuccessCallback(i), $.proxy(ui.printError, ui));
                    plugin.rtwGetNumberOfContainers(makeSuccessCallback(i), $.proxy(ui.printError, ui));
            }
        };
    })();
})();

function onPluginLoaded(pluginObject) {
    try {
        var noAutoRefresh = (document.location.search.indexOf("noauto") !== -1);
        var useConsole = (document.location.search.indexOf("log") !== -1);

        ui = new testUi(useConsole);
        plugin = new cryptoPlugin(pluginObject, noAutoRefresh);
        ui.registerEvents();
    } catch (error) {
        ui.writeln(error);
    }
}

window.onload = function () {
    var p = rutokenweb.ready;

    if (window.chrome && window.opr && window.opr.addons) {
        p = p.then(function () {
            return rutokenweb.isExtensionInstalled();
        }).then(function (result) {
            if (result) {
                return true;
            } else {
                return new Promise(function (resolve, reject) {
                    var button = $('#install-extension');

                    button.click(function () {
                        rutokenweb.installExtension().then(function () {
                            location.reload();
                        }, reject);
                    });

                    button.show();
                });
            }
        });
    } else if (window.chrome) {
        p = p.then(function () {
            return rutokenweb.isExtensionInstalled();
        }).then(function (result) {
            if (result) {
                return true;
            } else {
                throw "Rutoken Web Extension wasn't found";
            }
        });
    }

    p.then(function () {
        return rutokenweb.isPluginInstalled();
    }).then(function (result) {
        if (result) {
            return rutokenweb.loadPlugin();
        } else {
            throw "Rutoken Web Plugin wasn't found";
        }
    }).then(function (plugin) {
        return plugin.wrapWithOldInterface();
    }).then(function (wrappedPlugin) {
        onPluginLoaded(wrappedPlugin);
    }).then(undefined, function (reason) {
        console.log(reason);
    });
};
