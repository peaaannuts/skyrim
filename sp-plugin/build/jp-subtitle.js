/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "skyrimPlatform"
/*!***********************************!*\
  !*** external ["skyrimPlatform"] ***!
  \***********************************/
(module) {

module.exports = skyrimPlatform;

/***/ },

/***/ "./src/translations.json"
/*!*******************************!*\
  !*** ./src/translations.json ***!
  \*******************************/
(module) {

module.exports = /*#__PURE__*/JSON.parse('{"055DF8":"間違いなく、彼はそれが自分の主張を通す唯一の方法だと思ったのだ。そして、自分にはそれができると分かっていたからな。","093131":"周到な計画と、絶え間ない警戒によってだ。","0E24E7":"何が必要だ？","092D9E":"では、失礼する。私には守るべき街があるのでな。"}');

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			const getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! skyrimPlatform */ "skyrimPlatform");
/* harmony import */ var skyrimPlatform__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _translations_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./translations.json */ "./src/translations.json");


// FormID (6 hex, uppercase, e.g. "055DF8") -> Japanese text. Bundled at build time.
// Component A will later replace translations.json with the full DeepL-generated table.
var table = _translations_json__WEBPACK_IMPORTED_MODULE_1__;
function log(msg) {
    (0,skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.writeLogs)('jp-subtitle', msg);
}
// The native plugin returns the INFO FormID as a signed Int; read it unsigned and
// take the low 6 hex digits (plugin load-index 00 for vanilla Skyrim.esm).
function formIdKey(raw) {
    return ((raw >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
}
// Escape a string for safe embedding inside the JS source we hand to the CEF browser.
function esc(s) {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
}
// Inject a fixed-position overlay div once. Additive - does not replace the shared
// Skyrim Platform UI page, so it coexists with other mods' browser UI.
var overlayReady = false;
function ensureOverlay() {
    if (overlayReady)
        return;
    skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.browser.executeJavaScript("\n    if (!document.getElementById('jp-subtitle-overlay')) {\n      var d = document.createElement('div');\n      d.id = 'jp-subtitle-overlay';\n      d.style.position = 'fixed';\n      d.style.left = '50%';\n      d.style.bottom = '14%';\n      d.style.transform = 'translateX(-50%)';\n      d.style.maxWidth = '72%';\n      d.style.textAlign = 'center';\n      d.style.fontFamily = 'sans-serif';\n      d.style.fontSize = '30px';\n      d.style.lineHeight = '1.35';\n      d.style.color = '#ffe9c8';\n      d.style.textShadow = '0 0 4px #000, 0 0 8px #000, 0 2px 4px #000';\n      d.style.pointerEvents = 'none';\n      d.style.zIndex = '99999';\n      d.style.display = 'none';\n      document.body.appendChild(d);\n    }\n  ");
    overlayReady = true;
}
function showOverlay(text) {
    ensureOverlay();
    skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.browser.executeJavaScript("\n    (function(){\n      var d = document.getElementById('jp-subtitle-overlay');\n      if (d) { d.innerHTML = '".concat(esc(text), "'; d.style.display = 'block'; }\n    })();\n  "));
    skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.browser.setVisible(true);
    skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.browser.setFocused(false);
}
function hideOverlay() {
    skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.browser.executeJavaScript("\n    (function(){\n      var d = document.getElementById('jp-subtitle-overlay');\n      if (d) d.style.display = 'none';\n    })();\n  ");
}
function translateCurrent() {
    var raw = 0;
    try {
        raw = (0,skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.callNative)('JpSubtitle', 'GetCurrentDialogueFormID', undefined);
    }
    catch (e) {
        log("callNative failed: ".concat(e));
        return;
    }
    if (!raw) {
        log('no current dialogue FormID (0)');
        showOverlay('<span style="color:#aaa">（今表示中の字幕はありません）</span>');
        return;
    }
    var key = formIdKey(raw);
    var jp = table[key];
    if (jp) {
        log("hit ".concat(key, " -> ").concat(jp));
        showOverlay(jp);
    }
    else {
        log("miss ".concat(key, " (no translation yet)"));
        showOverlay("<span style=\"color:#ffb0b0\">\uFF3BFormID ".concat(key, " \u306E\u8A33\u306F\u672A\u767B\u9332\uFF3D</span>"));
    }
}
// Hotkey: F10 (DirectX scancode 68). Edge-detect so holding it does not re-fire.
var HOTKEY = 68;
var HIDE_KEY = 67; // F9: hide the overlay
var prevShow = false;
var prevHide = false;
(0,skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.on)('update', function () {
    var show = skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.Input.isKeyPressed(HOTKEY);
    if (show && !prevShow) {
        translateCurrent();
    }
    prevShow = show;
    var hide = skyrimPlatform__WEBPACK_IMPORTED_MODULE_0__.Input.isKeyPressed(HIDE_KEY);
    if (hide && !prevHide) {
        hideOverlay();
    }
    prevHide = hide;
});
log('jp-subtitle overlay plugin loaded');

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianAtc3VidGl0bGUuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLGdDOzs7Ozs7Ozs7Ozs7Ozs7O1VDQUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7V0M1QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLGlDQUFpQyxXQUFXO1dBQzVDO1dBQ0EsRTs7Ozs7V0NQQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQSwyQ0FBMkMsMENBQTBDO1dBQ3JGLE1BQU07V0FDTiwyQ0FBMkMsZ0NBQWdDO1dBQzNFO1dBQ0EsS0FBSyx5QkFBeUI7V0FDOUI7V0FDQSxHQUFHO1dBQ0g7V0FDQTtXQUNBLDBDQUEwQyx3Q0FBd0M7V0FDbEY7V0FDQTtXQUNBO1dBQ0EsRTs7Ozs7V0N0QkEsd0Y7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdELEU7Ozs7Ozs7Ozs7Ozs7O0FDTjJFO0FBQzVCO0FBQy9DO0FBQ0E7QUFDQSxZQUFZLCtDQUFZO0FBQ3hCO0FBQ0EsSUFBSSx5REFBUztBQUNiO0FBQ0EsOERBQThEO0FBQzlEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksbURBQU8sZ0ZBQWdGLDhDQUE4QyxxQ0FBcUMsbUNBQW1DLDZCQUE2QiwrQkFBK0IsK0NBQStDLGlDQUFpQyxxQ0FBcUMsMENBQTBDLGtDQUFrQyxvQ0FBb0Msa0NBQWtDLDBFQUEwRSx1Q0FBdUMsaUNBQWlDLGlDQUFpQyxxQ0FBcUMsT0FBTztBQUNudkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLG1EQUFPLHNDQUFzQywrREFBK0QsaUJBQWlCLHVDQUF1Qyw0QkFBNEIsT0FBTyxJQUFJO0FBQy9NLElBQUksbURBQU87QUFDWCxJQUFJLG1EQUFPO0FBQ1g7QUFDQTtBQUNBLElBQUksbURBQU8sc0NBQXNDLCtEQUErRCx3Q0FBd0MsT0FBTyxJQUFJO0FBQ25LO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYywwREFBVTtBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CO0FBQ25CO0FBQ0E7QUFDQSxrREFBRTtBQUNGLGVBQWUsaURBQUs7QUFDcEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlLGlEQUFLO0FBQ3BCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQztBQUNEIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vanAtc3VidGl0bGUvZXh0ZXJuYWwgdmFyIFtcInNreXJpbVBsYXRmb3JtXCJdIiwid2VicGFjazovL2pwLXN1YnRpdGxlL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2pwLXN1YnRpdGxlL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovL2pwLXN1YnRpdGxlL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9qcC1zdWJ0aXRsZS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2pwLXN1YnRpdGxlL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vanAtc3VidGl0bGUvLi9zcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsibW9kdWxlLmV4cG9ydHMgPSBza3lyaW1QbGF0Zm9ybTsiLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG5jb25zdCBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdGNvbnN0IGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHRjb25zdCBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdGlmICghKG1vZHVsZUlkIGluIF9fd2VicGFja19tb2R1bGVzX18pKSB7XG5cdFx0ZGVsZXRlIF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdFx0Y29uc3QgZSA9IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIgKyBtb2R1bGVJZCArIFwiJ1wiKTtcblx0XHRlLmNvZGUgPSAnTU9EVUxFX05PVF9GT1VORCc7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSAobW9kdWxlKSA9PiB7XG5cdGNvbnN0IGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyL3ZhbHVlIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRpZihBcnJheS5pc0FycmF5KGRlZmluaXRpb24pKSB7XG5cdFx0dmFyIGkgPSAwO1xuXHRcdHdoaWxlKGkgPCBkZWZpbml0aW9uLmxlbmd0aCkge1xuXHRcdFx0dmFyIGtleSA9IGRlZmluaXRpb25baSsrXTtcblx0XHRcdHZhciBiaW5kaW5nID0gZGVmaW5pdGlvbltpKytdO1xuXHRcdFx0aWYoIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRcdGlmKGJpbmRpbmcgPT09IDApIHtcblx0XHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiBkZWZpbml0aW9uW2krK10gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGJpbmRpbmcgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZihiaW5kaW5nID09PSAwKSB7IGkrKzsgfVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGNhbGxOYXRpdmUsIG9uLCBJbnB1dCwgYnJvd3Nlciwgd3JpdGVMb2dzIH0gZnJvbSAnc2t5cmltUGxhdGZvcm0nO1xyXG5pbXBvcnQgdHJhbnNsYXRpb25zIGZyb20gJy4vdHJhbnNsYXRpb25zLmpzb24nO1xyXG4vLyBGb3JtSUQgKDYgaGV4LCB1cHBlcmNhc2UsIGUuZy4gXCIwNTVERjhcIikgLT4gSmFwYW5lc2UgdGV4dC4gQnVuZGxlZCBhdCBidWlsZCB0aW1lLlxyXG4vLyBDb21wb25lbnQgQSB3aWxsIGxhdGVyIHJlcGxhY2UgdHJhbnNsYXRpb25zLmpzb24gd2l0aCB0aGUgZnVsbCBEZWVwTC1nZW5lcmF0ZWQgdGFibGUuXHJcbnZhciB0YWJsZSA9IHRyYW5zbGF0aW9ucztcclxuZnVuY3Rpb24gbG9nKG1zZykge1xyXG4gICAgd3JpdGVMb2dzKCdqcC1zdWJ0aXRsZScsIG1zZyk7XHJcbn1cclxuLy8gVGhlIG5hdGl2ZSBwbHVnaW4gcmV0dXJucyB0aGUgSU5GTyBGb3JtSUQgYXMgYSBzaWduZWQgSW50OyByZWFkIGl0IHVuc2lnbmVkIGFuZFxyXG4vLyB0YWtlIHRoZSBsb3cgNiBoZXggZGlnaXRzIChwbHVnaW4gbG9hZC1pbmRleCAwMCBmb3IgdmFuaWxsYSBTa3lyaW0uZXNtKS5cclxuZnVuY3Rpb24gZm9ybUlkS2V5KHJhdykge1xyXG4gICAgcmV0dXJuICgocmF3ID4+PiAwKSAmIDB4ZmZmZmZmKS50b1N0cmluZygxNikucGFkU3RhcnQoNiwgJzAnKS50b1VwcGVyQ2FzZSgpO1xyXG59XHJcbi8vIEVzY2FwZSBhIHN0cmluZyBmb3Igc2FmZSBlbWJlZGRpbmcgaW5zaWRlIHRoZSBKUyBzb3VyY2Ugd2UgaGFuZCB0byB0aGUgQ0VGIGJyb3dzZXIuXHJcbmZ1bmN0aW9uIGVzYyhzKSB7XHJcbiAgICByZXR1cm4gc1xyXG4gICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXHJcbiAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJyAnKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXHIvZywgJycpO1xyXG59XHJcbi8vIEluamVjdCBhIGZpeGVkLXBvc2l0aW9uIG92ZXJsYXkgZGl2IG9uY2UuIEFkZGl0aXZlIC0gZG9lcyBub3QgcmVwbGFjZSB0aGUgc2hhcmVkXHJcbi8vIFNreXJpbSBQbGF0Zm9ybSBVSSBwYWdlLCBzbyBpdCBjb2V4aXN0cyB3aXRoIG90aGVyIG1vZHMnIGJyb3dzZXIgVUkuXHJcbnZhciBvdmVybGF5UmVhZHkgPSBmYWxzZTtcclxuZnVuY3Rpb24gZW5zdXJlT3ZlcmxheSgpIHtcclxuICAgIGlmIChvdmVybGF5UmVhZHkpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgYnJvd3Nlci5leGVjdXRlSmF2YVNjcmlwdChcIlxcbiAgICBpZiAoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqcC1zdWJ0aXRsZS1vdmVybGF5JykpIHtcXG4gICAgICB2YXIgZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xcbiAgICAgIGQuaWQgPSAnanAtc3VidGl0bGUtb3ZlcmxheSc7XFxuICAgICAgZC5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XFxuICAgICAgZC5zdHlsZS5sZWZ0ID0gJzUwJSc7XFxuICAgICAgZC5zdHlsZS5ib3R0b20gPSAnMTQlJztcXG4gICAgICBkLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGVYKC01MCUpJztcXG4gICAgICBkLnN0eWxlLm1heFdpZHRoID0gJzcyJSc7XFxuICAgICAgZC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcXG4gICAgICBkLnN0eWxlLmZvbnRGYW1pbHkgPSAnc2Fucy1zZXJpZic7XFxuICAgICAgZC5zdHlsZS5mb250U2l6ZSA9ICczMHB4JztcXG4gICAgICBkLnN0eWxlLmxpbmVIZWlnaHQgPSAnMS4zNSc7XFxuICAgICAgZC5zdHlsZS5jb2xvciA9ICcjZmZlOWM4JztcXG4gICAgICBkLnN0eWxlLnRleHRTaGFkb3cgPSAnMCAwIDRweCAjMDAwLCAwIDAgOHB4ICMwMDAsIDAgMnB4IDRweCAjMDAwJztcXG4gICAgICBkLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XFxuICAgICAgZC5zdHlsZS56SW5kZXggPSAnOTk5OTknO1xcbiAgICAgIGQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGQpO1xcbiAgICB9XFxuICBcIik7XHJcbiAgICBvdmVybGF5UmVhZHkgPSB0cnVlO1xyXG59XHJcbmZ1bmN0aW9uIHNob3dPdmVybGF5KHRleHQpIHtcclxuICAgIGVuc3VyZU92ZXJsYXkoKTtcclxuICAgIGJyb3dzZXIuZXhlY3V0ZUphdmFTY3JpcHQoXCJcXG4gICAgKGZ1bmN0aW9uKCl7XFxuICAgICAgdmFyIGQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanAtc3VidGl0bGUtb3ZlcmxheScpO1xcbiAgICAgIGlmIChkKSB7IGQuaW5uZXJIVE1MID0gJ1wiLmNvbmNhdChlc2ModGV4dCksIFwiJzsgZC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJzsgfVxcbiAgICB9KSgpO1xcbiAgXCIpKTtcclxuICAgIGJyb3dzZXIuc2V0VmlzaWJsZSh0cnVlKTtcclxuICAgIGJyb3dzZXIuc2V0Rm9jdXNlZChmYWxzZSk7XHJcbn1cclxuZnVuY3Rpb24gaGlkZU92ZXJsYXkoKSB7XHJcbiAgICBicm93c2VyLmV4ZWN1dGVKYXZhU2NyaXB0KFwiXFxuICAgIChmdW5jdGlvbigpe1xcbiAgICAgIHZhciBkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pwLXN1YnRpdGxlLW92ZXJsYXknKTtcXG4gICAgICBpZiAoZCkgZC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xcbiAgICB9KSgpO1xcbiAgXCIpO1xyXG59XHJcbmZ1bmN0aW9uIHRyYW5zbGF0ZUN1cnJlbnQoKSB7XHJcbiAgICB2YXIgcmF3ID0gMDtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmF3ID0gY2FsbE5hdGl2ZSgnSnBTdWJ0aXRsZScsICdHZXRDdXJyZW50RGlhbG9ndWVGb3JtSUQnLCB1bmRlZmluZWQpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICBsb2coXCJjYWxsTmF0aXZlIGZhaWxlZDogXCIuY29uY2F0KGUpKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoIXJhdykge1xyXG4gICAgICAgIGxvZygnbm8gY3VycmVudCBkaWFsb2d1ZSBGb3JtSUQgKDApJyk7XHJcbiAgICAgICAgc2hvd092ZXJsYXkoJzxzcGFuIHN0eWxlPVwiY29sb3I6I2FhYVwiPu+8iOS7iuihqOekuuS4reOBruWtl+W5leOBr+OBguOCiuOBvuOBm+OCk++8iTwvc3Bhbj4nKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB2YXIga2V5ID0gZm9ybUlkS2V5KHJhdyk7XHJcbiAgICB2YXIganAgPSB0YWJsZVtrZXldO1xyXG4gICAgaWYgKGpwKSB7XHJcbiAgICAgICAgbG9nKFwiaGl0IFwiLmNvbmNhdChrZXksIFwiIC0+IFwiKS5jb25jYXQoanApKTtcclxuICAgICAgICBzaG93T3ZlcmxheShqcCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBsb2coXCJtaXNzIFwiLmNvbmNhdChrZXksIFwiIChubyB0cmFuc2xhdGlvbiB5ZXQpXCIpKTtcclxuICAgICAgICBzaG93T3ZlcmxheShcIjxzcGFuIHN0eWxlPVxcXCJjb2xvcjojZmZiMGIwXFxcIj5cXHVGRjNCRm9ybUlEIFwiLmNvbmNhdChrZXksIFwiIFxcdTMwNkVcXHU4QTMzXFx1MzA2RlxcdTY3MkFcXHU3NjdCXFx1OTMzMlxcdUZGM0Q8L3NwYW4+XCIpKTtcclxuICAgIH1cclxufVxyXG4vLyBIb3RrZXk6IEYxMCAoRGlyZWN0WCBzY2FuY29kZSA2OCkuIEVkZ2UtZGV0ZWN0IHNvIGhvbGRpbmcgaXQgZG9lcyBub3QgcmUtZmlyZS5cclxudmFyIEhPVEtFWSA9IDY4O1xyXG52YXIgSElERV9LRVkgPSA2NzsgLy8gRjk6IGhpZGUgdGhlIG92ZXJsYXlcclxudmFyIHByZXZTaG93ID0gZmFsc2U7XHJcbnZhciBwcmV2SGlkZSA9IGZhbHNlO1xyXG5vbigndXBkYXRlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHNob3cgPSBJbnB1dC5pc0tleVByZXNzZWQoSE9US0VZKTtcclxuICAgIGlmIChzaG93ICYmICFwcmV2U2hvdykge1xyXG4gICAgICAgIHRyYW5zbGF0ZUN1cnJlbnQoKTtcclxuICAgIH1cclxuICAgIHByZXZTaG93ID0gc2hvdztcclxuICAgIHZhciBoaWRlID0gSW5wdXQuaXNLZXlQcmVzc2VkKEhJREVfS0VZKTtcclxuICAgIGlmIChoaWRlICYmICFwcmV2SGlkZSkge1xyXG4gICAgICAgIGhpZGVPdmVybGF5KCk7XHJcbiAgICB9XHJcbiAgICBwcmV2SGlkZSA9IGhpZGU7XHJcbn0pO1xyXG5sb2coJ2pwLXN1YnRpdGxlIG92ZXJsYXkgcGx1Z2luIGxvYWRlZCcpO1xyXG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=