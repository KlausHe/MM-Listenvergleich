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
	stateDashOnly = KadUtils.KadDOM.resetInput(idCB_dashOnly, false);
	KadUtils.daEL(idCB_dashOnly, "change", dashOnlyFilter);

	KadUtils.daEL(idBtn_refreshParsing, "click", refreshParsing);

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
}

let customNumbers = null;
let stateDashZero;
let stateDashOnly;
let stateIgnoreAssembly;
let stateIgnoreRawmaterial;
let nameAssembly = "Baugruppe";
let nameRawmaterial = "Rohmaterial";

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const foundInSOU = "im SOU";
const foundInCAD = "im CAD";
const parsedHeader = [mmID, "SOU", "CAD", name, partFamily, foundInSOU, foundInCAD];
const allLoadedHeader = [mmID, count, name, partFamily];

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
}

function dashZeroFilter(event) {
	stateDashZero = event.target.checked;
}
function dashOnlyFilter(event) {
	stateDashOnly = event.target.checked;
}
function ignoreAssemblyFilter(event) {
	stateIgnoreAssembly = event.target.checked;
}
function ignoreRawmaterialFilter(event) {
	stateIgnoreRawmaterial = event.target.checked;
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

		text = text.replace(/^\d{6}_/, ""); // remove MM-Nummer and _
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

		text = text.replace(/^\d{6}_/, ""); // remove MM-Nummer

		if (cleanDashOnly(text)) continue; // ignore DashOnly
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
	KadUtils.dbIDStyle(`idLbl_input${type}`).backgroundColor = "limegreen";

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
	return id % 10 == 0;
}
function cleanCustomNumbers(id) {
	if (customNumbers == null) return false;
	let s = customNumbers.includes(Number(id));
	return s;
}
function cleanDashOnly(text) {
	if (!stateDashOnly) return false;
	return text.trim().substring(0, 1) === "-";
}
function cleanDashZero(text) {
	if (!stateDashZero) return false;
	return text.trim().substring(0, 2) === "-0";
}

// -----------------------------
function startCompare() {
	dataObject.compared = {};
	dataObject.notInSOU = {};
	dataObject.notInCAD = {};

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

	const book = utils.book_new();

	const sheetDiff = utils.json_to_sheet(Object.values(dataObject.difference));
	const sheetSOU = utils.json_to_sheet(Object.values(dataObject.notInSOU));
	const sheetCAD = utils.json_to_sheet(Object.values(dataObject.notInCAD));
	const sheetComp = utils.json_to_sheet(Object.values(dataObject.compared));
	const sheetAllSOU = utils.json_to_sheet(Object.values(dataObject.allSOU));
	const sheetAllCAD = utils.json_to_sheet(Object.values(dataObject.allCAD));

	utils.book_append_sheet(book, sheetDiff, "Differenz");
	utils.book_append_sheet(book, sheetSOU, "Nicht im SOU");
	utils.book_append_sheet(book, sheetCAD, "Nicht im CAD");
	utils.book_append_sheet(book, sheetComp, "Alles");
	utils.book_append_sheet(book, sheetAllSOU, "geladen aus SOU");
	utils.book_append_sheet(book, sheetAllCAD, "geladen aus CAD");

	const name = filename.book || "Stücklistenvergleich";
	writeFile(book, `${name}.xlsx`);
}
