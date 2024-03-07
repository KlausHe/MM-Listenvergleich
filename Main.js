import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "./Data/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	KadUtils.dbID(idLbl_loadedSOU).textContent = "nicht geladen";
	KadUtils.dbID(idLbl_loadedCAD).textContent = "nicht geladen";
	KadUtils.daEL(idVin_inputSOU, "change", (evt) => getFile(evt, "SOU"));
	KadUtils.daEL(idVin_inputCAD, "change", (evt) => getFile(evt, "TEXT"));
	KadUtils.daEL(idBtn_infoFilter, "click", openInfoFilter);
	KadUtils.daEL(idBtn_infoCloseFilter, "click", closeInfoFilter);
	KadUtils.daEL(idBtn_infoTokenfilter, "click", openInfoTokenfilter);
	KadUtils.daEL(idBtn_infoCloseTokenfilter, "click", closeInfoTokenfilter);
	KadUtils.daEL(idBtn_infoSOU, "click", openInfoSOU);
	KadUtils.daEL(idBtn_infoCloseSOU, "click", closeInfoSOU);
	KadUtils.daEL(idBtn_infoCAD, "click", openInfoCAD);
	KadUtils.daEL(idBtn_infoCloseCAD, "click", closeInfoCAD);

	KadUtils.KadDOM.resetInput(idArea_customNumbers, "MM-Nummern in CAD-Datei ignorieren");
	KadUtils.dbID(idLbl_customNumbers).textContent = "...";
	KadUtils.daEL(idArea_customNumbers, "input", getcustomNumbers);
	stateIgnoreAssembly = KadUtils.KadDOM.resetInput(idCB_ignoreAssembly, true);
	KadUtils.daEL(idCB_ignoreAssembly, "change", ignoreAssemblyFilter);
	stateIgnoreRawmaterial = KadUtils.KadDOM.resetInput(idCB_ignoreRawmaterial, true);
	KadUtils.daEL(idCB_ignoreRawmaterial, "change", ignoreRawmaterialFilter);
	stateDashZero = KadUtils.KadDOM.resetInput(idCB_dashZero, true);
	KadUtils.daEL(idCB_dashZero, "change", dashZeroFilter);

	KadUtils.KadDOM.resetInput(idArea_tokenfilter, "zusätzliche Schlagwörter");
	KadUtils.dbID(idLbl_tokenfilter).textContent = "Keine zusätzlichen Token eingegeben!";
	KadUtils.daEL(idArea_tokenfilter, "input", getcustomToken);

	KadUtils.dbID(idLbl_filteredSOU).textContent = "...";
	KadUtils.dbID(idLbl_filteredCAD).textContent = "...";
	KadUtils.dbID(idLbl_errorsFound).textContent = "...";
	KadUtils.dbID(idLbl_missingSOU).textContent = "...";
	KadUtils.dbID(idLbl_missingCAD).textContent = "...";
	KadUtils.daEL(idBtn_download, "click", startDownload);
	KadUtils.KadDOM.resetInput(idVin_fileName, "Dateiname eingeben");
	KadUtils.dbID(idLbl_fileName).textContent = `*.xlsx`;
	KadUtils.daEL(idVin_fileName, "input", setFileNameFromInput);
	KadUtils.KadDOM.enableBtn(idBtn_download, false);

	populateTokenList(idUL_SOU, ulInfoSOU);
	populateTokenList(idUL_CAD, ulInfoCAD);
	populateTokenList(idUL_filter, ulInfFilter);
	populateTokenList(idUL_tokenfilterList, [...Tokenlist[0], ...Tokenlist[2]]);
}

let customNumbers = null;
let stateDashZero;
let stateIgnoreAssembly;
let stateIgnoreRawmaterial;
const nameAssembly = "Baugruppe";
const thresholdNumberAssembly = 9990;
const nameRawmaterial = "Rohmaterial";

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const foundInSOU = "im SOU";
const foundInCAD = "im CAD";

const ulInfoSOU = ["Stückliste der Baugruppe aufrufen", "Reporte -> Mengenstückliste", "In Zwischenablage speichern", "Neue Excel-Datei öffnen", "Zwischenablage in Zelle A1 kopieren", "Mit beliebigem Namen speichern", "Der Dateiname wird für die Vergleichsdatei verwendet"];
const ulInfoCAD = ["Baugruppe ins CAD laden", `Baugruppe als "Root" oder alles andere löschen`, "RMT in Strukturliste auf freien Bereich", `"Einstellung" -> "Erweitern"`, `Alles außer "Pseudobaugruppe" deaktivieren -> "OK"`, "RMT in Strukturliste auf freien Bereich", `"Aktion" -> "Baum schreiben"`, "Datei als .txt speichern"];
const ulInfFilter = [`"Baugruppen ignorieren" filtert im SOU nur nach Teilefamilie, nicht nach MM-Nummer`, `Baugruppen werden erst ab MM-Nummer ${thresholdNumberAssembly} ignoriert`, `"-0..." ignoriert alle Teile, die direkt nach der MM-Nummer ein "-0" besitzen: 264610-01_Controller`];

const Tokenlist = [["bearb", "bearbeitet", "Trennsteg", "Näherungsschalter"], [], [], []]; // fix Tokenx, userInput-Tokens, fix Numbers, userInput-Numbers

const filename = {
	book: "",
	input: "",
	file: "",
};
const fileData = {
	SOU: null,
	CAD: null,
};

const dataObject = {
	SOU: {},
	CAD: {},
	difference: {},
	compared: {},
	notInSOU: {},
	notInCAD: {},
	allSOU: {},
	allCAD: {},
	tokenlist: {},
};

const fileLoaded = {
	SOU: false,
	CAD: false,
};

function openInfoFilter() {
	KadUtils.dbID(idDia_Filter).showModal();
}
function closeInfoFilter() {
	KadUtils.dbID(idDia_Filter).close();
}
function openInfoTokenfilter() {
	KadUtils.dbID(idDia_Tokenfilter).showModal();
}
function closeInfoTokenfilter() {
	KadUtils.dbID(idDia_Tokenfilter).close();
}
function openInfoSOU() {
	KadUtils.dbID(idDia_SOU).showModal();
}
function closeInfoSOU() {
	KadUtils.dbID(idDia_SOU).close();
}
function openInfoCAD() {
	KadUtils.dbID(idDia_CAD).showModal();
}
function closeInfoCAD() {
	KadUtils.dbID(idDia_CAD).close();
}

function populateTokenList(parentID, list) {
	let ulParent = KadUtils.dbID(parentID);
	for (let token of list) {
		const li = document.createElement("li");
		li.append(token);
		ulParent.append(li);
	}
}

function getcustomToken(event) {
	let results = event.target.value;
	Tokenlist[1] = results.match(/[A-z]+/g);
	Tokenlist[3] = results.match(/\d{6}/g);
	let text = "";
	if (Tokenlist[1] == null && Tokenlist[3] == null) {
		KadUtils.dbID(idLbl_tokenfilter).innerHTML = "Keine zusätzlichen Token erkannt!";
		return;
	}

	if (Tokenlist[1] != null) {
		text = `Token erkannt:<br>`;
		text += Tokenlist[1].join("<br>");
	}

	if (Tokenlist[3] != null) {
		if (Tokenlist[1] != null) text += "<br>";
		text += `MM-Nummer erkannt:<br>`;
		text += Tokenlist[3].join("<br>");
	}
	KadUtils.dbID(idLbl_tokenfilter).innerHTML = text;
}
function getcustomNumbers(event) {
	let results = event.target.value;
	customNumbers = results.match(/\d{6}/g);
	let text = "";
	if (customNumbers == null) {
		KadUtils.dbID(idLbl_customNumbers).textContent = "...";
		return;
	}
	customNumbers = customNumbers.map((n) => Number(n));
	const num = customNumbers.length;
	const word = num == 1 ? "Nummer" : "Nummern";
	text = `${num} ${word} ignoriert:`;
	for (let [index, t] of customNumbers.entries()) {
		if (index % 3 == 0) text += "<br>";
		text += ` ${t} `;
	}
	KadUtils.dbID(idLbl_customNumbers).innerHTML = text;
	refreshParsing();
}

function dashZeroFilter(event) {
	stateDashZero = event.target.checked;
	refreshParsing();
}
function ignoreAssemblyFilter(event) {
	stateIgnoreAssembly = event.target.checked;
	refreshParsing();
}
function ignoreRawmaterialFilter(event) {
	stateIgnoreRawmaterial = event.target.checked;
	refreshParsing();
}

function refreshParsing() {
	if (fileLoaded.SOU) parseFileExcel();
	if (fileLoaded.CAD) parseFileText();
}

function setFileNameFromInput(event) {
	filename.input = event.target.value;
	handleFilename();
}

function setFileNameFromFile(name) {
	filename.file = `${name.split(".")[0]}_Vergleich`;
	handleFilename();
}

function handleFilename() {
	filename.book = filename.input || filename.file;
	KadUtils.dbID(idLbl_fileName).textContent = `${filename.book}.xlsx`;
}

function getFile(file, type) {
	let selectedFile = file.target.files[0];
	let fileReader = new FileReader();
	if (type == "SOU") {
		fileReader.onload = (event) => {
			setFileNameFromFile(file.target.files[0].name);
			const data = event.target.result;
			let workbook = read(data, { type: "binary" });
			workbook.SheetNames.forEach((sheet) => {
				fileData.SOU = utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
			});
			fileLoaded.SOU = true;
			parseFileExcel();
		};
		fileReader.readAsBinaryString(selectedFile);
	}
	if (type == "TEXT") {
		fileReader.onload = (event) => {
			fileData.CAD = event.target.result.split(/\r?\n/);
			fileLoaded.CAD = true;
			parseFileText();
		};
		fileReader.readAsText(selectedFile);
	}
}

function parseFileExcel() {
	dataObject.SOU = {};
	dataObject.allSOU = {};

	for (let obj of fileData.SOU) {
		if (obj[mmID]) {
			let id = Number(obj[mmID]); // get MM-Nummer
			dataObject.allSOU[id] = {
				[mmID]: obj[mmID],
				[count]: obj[count],
				[name]: obj[name],
				[partFamily]: obj[partFamily] ? obj[partFamily] : "---",
			};
		}
	}

	let tempSouClone = KadUtils.deepClone(fileData.SOU);
	if (stateIgnoreAssembly) {
		tempSouClone = tempSouClone.filter((obj) => obj[partFamily] != nameAssembly);
	}
	if (stateIgnoreRawmaterial) {
		tempSouClone = tempSouClone.filter((obj) => obj[partFamily] != nameRawmaterial);
	}

	for (let obj of tempSouClone) {
		if (obj[mmID]) {
			let id = Number(obj[mmID]); // get MM-Nummer
			if (dataObject.SOU[id] === undefined) {
				dataObject.SOU[id] = obj;
			} else {
				dataObject.SOU[id][count] += obj[count];
			}
		}
	}
	fileIsParsed("SOU");
	createTokenlist();
}

function parseFileText() {
	dataObject.CAD = {};
	dataObject.allCAD = {};

	// no filter
	for (let row of fileData.CAD) {
		if (row.trim() == "") continue;
		let text = row.trim();
		if (text.trim().substring(0, 3) === "|--") text = text.trimStart().slice(3); // remove "|--"
		let id = Number(text.slice(0, 6)); // get MM-Nummer
		if (Number.isNaN(id)) continue; // ignore MM-Nummer is NaN
		if (cleanParentheses(text)) continue; // ignore drawings and exemplares

		text = text.replace(/^\d{6}_?/, ""); // remove MM-Nummer and _
		text = text.split("[")[0].trim(); // remove trailing [xx]

		if (dataObject.allCAD[id] === undefined) {
			dataObject.allCAD[id] = {
				[mmID]: id,
				[count]: 1,
				[name]: text,
				[partFamily]: "aus CAD",
			};
		} else {
			dataObject.allCAD[id][count]++;
		}
	}

	// filter
	for (let row of fileData.CAD) {
		if (row.trim() == "") continue;
		let text = row.trim();
		if (text.trim().substring(0, 3) === "|--") text = text.trimStart().slice(3); // remove "|--"

		if (cleanParentheses(text)) continue; // ignore drawings and exemplares
		if (text.search(/\D/) != 6) continue; // ignore rows with non starting 6 digit number

		let id = Number(text.slice(0, 6)); // get MM-Nummer
		if (Number.isNaN(id)) continue; // ignore MM-Nummer is NaN
		if (cleanBaugruppe(id)) continue; // ignore Baugruppe
		if (cleanCustomNumbers(id)) continue; // ignore customNumbers

		text = text.replace(/^\d{6}_?/, ""); // remove MM-Nummer

		if (cleanDashZero(text)) continue; // ignore DashZero
		text = text.split("[")[0].trim(); // remove trailing [xx]

		if (dataObject.CAD[id] === undefined) {
			dataObject.CAD[id] = {
				[mmID]: id,
				[count]: 1,
				[name]: text,
				[partFamily]: "aus CAD",
			};
		} else {
			dataObject.CAD[id][count]++;
		}
	}
	fileIsParsed("CAD");
}

function fileIsParsed(type) {
	const count = type == "SOU" ? KadUtils.objectLength(dataObject.allSOU) : KadUtils.objectLength(dataObject.allCAD);
	KadUtils.dbID(`idLbl_loaded${type}`).textContent = `${count} Teile geladen`;
	KadUtils.KadDOM.btnColor(`idLbl_input${type}`, "positive");
	setTimeout(() => {
		KadUtils.KadDOM.btnColor(`idLbl_input${type}`, null);
	}, 3000);

	KadUtils.dbID(`idLbl_filtered${type}`).textContent = `${KadUtils.objectLength(dataObject[type])} / ${KadUtils.objectLength(dataObject[`all${type}`])}`;

	if (fileLoaded.SOU && fileLoaded.CAD) {
		startCompare();
	}
}

// CLEANING -----------------------------
function cleanParentheses(text) {
	if (text.match(/\[\]/)) return true; //cleanDrawings
	if (text.match(/\(\d{0,}\)/)) return true; //cleanDrawings
	return false;
}
function cleanBaugruppe(id) {
	if (!stateIgnoreAssembly) return false;
	if (id < thresholdNumberAssembly) return false;
	return id % 10 == 0;
}
function cleanCustomNumbers(id) {
	if (customNumbers == null) return false;
	let s = customNumbers.includes(Number(id));
	return s;
}
function cleanDashZero(text) {
	if (!stateDashZero) return false;
	return `${text}`.trim().substring(0, 2) === "-0"; // make a copy of the string
}

// -----------------------------
function startCompare() {
	dataObject.compared = {};
	dataObject.notInSOU = {};
	dataObject.notInCAD = {};
	dataObject.tokenlist = {};

	for (let [souKey, souValue] of Object.entries(dataObject.SOU)) {
		const cadCount = dataObject.CAD[souKey] == null ? 0 : dataObject.CAD[souKey][count];
		dataObject.compared[souKey] = {
			[mmID]: souValue[mmID],
			SOU: souValue[count],
			CAD: cadCount,
			[name]: souValue[name],
			[partFamily]: souValue[partFamily] ? souValue[partFamily] : "---",
			[foundInSOU]: true,
			[foundInCAD]: cadCount == 0 ? false : true,
		};
		if (cadCount == 0) dataObject.notInCAD[souKey] = dataObject.compared[souKey];
	}

	for (let [cadKey, cadValue] of Object.entries(dataObject.CAD)) {
		if (dataObject.compared[cadKey] === undefined) {
			dataObject.compared[cadKey] = {
				[mmID]: cadValue[mmID],
				SOU: 0,
				CAD: cadValue[count],
				[name]: cadValue[name],
				[partFamily]: cadValue[partFamily],
				[foundInSOU]: false,
				[foundInCAD]: true,
			};
			dataObject.notInSOU[cadKey] = dataObject.compared[cadKey];
		}
	}

	dataObject.difference = Object.values(dataObject.compared).filter((obj) => obj.SOU != obj.CAD);

	KadUtils.dbID(idLbl_errorsFound).textContent = KadUtils.objectLength(dataObject.difference);
	KadUtils.dbID(idLbl_missingSOU).textContent = KadUtils.objectLength(dataObject.notInSOU);
	KadUtils.dbID(idLbl_missingCAD).textContent = KadUtils.objectLength(dataObject.notInCAD);

	KadUtils.KadDOM.enableBtn(idBtn_download, true);
}

function startDownload() {
	refreshParsing();
	createTokenlist();

	const book = utils.book_new();

	const sheetDiff = utils.json_to_sheet(Object.values(dataObject.difference));
	const sheetSOU = utils.json_to_sheet(Object.values(dataObject.notInSOU));
	const sheetCAD = utils.json_to_sheet(Object.values(dataObject.notInCAD));
	const sheetComp = utils.json_to_sheet(Object.values(dataObject.compared));
	const sheetAllSOU = utils.json_to_sheet(Object.values(dataObject.allSOU));
	const sheetAllCAD = utils.json_to_sheet(Object.values(dataObject.allCAD));
	const sheetTokenlist = utils.json_to_sheet(Object.values(dataObject.tokenlist));

	utils.book_append_sheet(book, sheetDiff, "Differenz");
	utils.book_append_sheet(book, sheetSOU, "Nicht im SOU");
	utils.book_append_sheet(book, sheetCAD, "Nicht im CAD");
	utils.book_append_sheet(book, sheetComp, "Alles");
	utils.book_append_sheet(book, sheetAllSOU, "geladen aus SOU");
	utils.book_append_sheet(book, sheetAllCAD, "geladen aus CAD");
	utils.book_append_sheet(book, sheetTokenlist, "Schlagwortfilter");

	const name = filename.book || "Stücklistenvergleich";
	writeFile(book, `${name}.xlsx`);
}

function createTokenlist() {
	for (let token of [...Tokenlist[0], ...Tokenlist[1]]) {
		let found = false;
		for (let [souKey, souValue] of Object.entries(dataObject.SOU)) {
			if (souValue[name].toLowerCase().includes(token.toLowerCase())) {
				found = true;
				dataObject.tokenlist[souKey] = {
					[mmID]: souValue[mmID],
					SOU: souValue[count],
					[name]: souValue[name],
					[partFamily]: souValue[partFamily] ? souValue[partFamily] : "---",
				};
			}
		}
		if (!found) {
			dataObject.tokenlist[token] = {
				[mmID]: token,
				SOU: 0,
				[name]: "nicht vorhanden",
				[partFamily]: "",
			};
		}
	}
	// search for fix Numbers
	for (let number of [...Tokenlist[2], ...Tokenlist[3]]) {
		let found = false;
		for (let [souKey, souValue] of Object.entries(dataObject.SOU)) {
			if (number == souKey) {
				found = true;
				dataObject.tokenlist[souKey] = {
					[mmID]: souValue[mmID],
					SOU: souValue[count],
					[name]: souValue[name],
					[partFamily]: souValue[partFamily] ? souValue[partFamily] : "---",
				};
			}
		}
		if (!found) {
			dataObject.tokenlist[number] = {
				[mmID]: number,
				SOU: 0,
				[name]: "nicht vorhanden",
				[partFamily]: "",
			};
		}
	}
}
