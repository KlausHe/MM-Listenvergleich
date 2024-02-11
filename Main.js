import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "./Data/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	KadUtils.dbID(idLbl_loadedSOU).textContent = "nicht geladen";
	KadUtils.dbID(idLbl_loadedCAD).textContent = "nicht geladen";
	KadUtils.daEL(idVin_inputSOU, "change", (evt) => getFile(evt, "SOU"));
	KadUtils.daEL(idVin_inputCAD, "change", (evt) => getFile(evt, "TEXT"));
	KadUtils.daEL(idBtn_infoSOU, "click", openInfoSOU);
	KadUtils.daEL(idBtn_infoCloseSOU, "click", closeInfoSOU);
	KadUtils.daEL(idBtn_infoCAD, "click", openInfoCAD);
	KadUtils.daEL(idBtn_infoCloseCAD, "click", closeInfoCAD);

	KadUtils.KadDOM.resetInput(idArea_customNumbers, "MM-Nummern in CAD-Datei ignorieren");
	KadUtils.dbID(idLbl_customNumbers).textContent = "...";
	KadUtils.daEL(idArea_customNumbers, "input", getcustomNumbers);
	stateIgnoreAssembly = KadUtils.KadDOM.resetInput(idCB_ignoreAssembly, true);
	KadUtils.daEL(idCB_ignoreAssembly, "change", ignoreAssemblyFilter);
	stateDashZero = KadUtils.KadDOM.resetInput(idCB_dashZero, false);
	KadUtils.daEL(idCB_dashZero, "change", dashZeroFilter);

	KadUtils.daEL(idBtn_refreshParsing, "click", refreshParsing);

	KadUtils.dbID(idLbl_errorsFound).textContent = "...";
	KadUtils.dbID(idLbl_missingSOU).textContent = "...";
	KadUtils.dbID(idLbl_missingCAD).textContent = "...";
	KadUtils.daEL(idBtn_download, "click", startDownload);
	KadUtils.KadDOM.resetInput(idVin_fileName, "Dateiname eingeben");
	KadUtils.dbID(idLbl_fileName).textContent = `*.xlsx`;
	KadUtils.daEL(idVin_fileName, "input", setFileNameFromInput);
	KadUtils.KadDOM.enableBtn(idBtn_download, false);
}

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const filterFamily = ["Rohmaterial", "Baugruppe"];
const foundInSOU = "inSOU";
const foundInCAD = "inCAD";
const parsedHeader = [mmID, "SOU", "CAD", name, partFamily, foundInSOU, foundInCAD];

let customNumbers = null;
let stateDashZero = false;
let stateIgnoreAssembly = false;
let filename = {
	book: "",
	input: "",
	file: "",
};

let filenameFromInput = "";
let filenameFromFile = "";
let filedataSOU = null;
let filedataCAD = null;
let objectListSOU = {};
let objectListCAD = {};
let objectListCompared = {};
let objectListDifferences = {};
let dataDiff = [];
let dataComp = [];
let dataNotInCAD = [];
let dataNotInSOU = [];
let filesParsed = {
	SOU: false,
	CAD: false,
};

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
function ignoreAssemblyFilter(event) {
	stateIgnoreAssembly = event.target.checked;
}

function refreshParsing() {
	if (filesParsed.SOU) parseFileExcel();
	if (filesParsed.CAD) parseFileText();
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
			filedataSOU = event.target.result;
			parseFileExcel();
		};
		fileReader.readAsBinaryString(selectedFile);
	}
	if (type == "TEXT") {
		fileReader.onload = (event) => {
			filedataCAD = event.target.result.split(/\r?\n/);
			parseFileText();
		};
		fileReader.readAsText(selectedFile);
	}
}

function parseFileExcel() {
	let workbook = read(filedataSOU, { type: "binary" });
	workbook.SheetNames.forEach((sheet) => {
		objectListSOU = {};
		let dataArray = utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
		const filtered = dataArray.filter((obj) => !filterFamily.includes(obj[partFamily]));
		for (let obj of filtered) {
			if (obj[mmID]) {
				let id = obj[mmID].toString().padStart(6, "0");
				if (objectListSOU[id] === undefined) {
					objectListSOU[id] = obj; // objectListSOU[id][mmID] = id; // format as String with leading 0
				} else {
					objectListSOU[id][count] += obj[count];
				}
			}
		}
		fileIsParsed("SOU");
	});
}

function parseFileText() {
	objectListCAD = {};
	for (let row of filedataCAD) {
		if (row.trim() == "") continue;
		let text = row.trim();
		if (text.trim().substring(0, 3) === "|--") text = text.trimStart().slice(3); // remove "|--"

		if (cleanParentheses(text)) continue; // ignore drawings and exemplares
		if (text.search(/\D/) != 6) continue; // ignore rows with non starting 6 digit number

		let id = Number(text.slice(0, 6)); // get MM-Nummer
		if (Number.isNaN(id)) {
			continue; // ignore MM-Nummer is NaN
		} else {
			id = id.toString().padStart(6, "0");
		}
		if (cleanBaugruppe(id)) continue; // ignore Baugruppe
		if (cleanCustomNumbers(id)) continue; // ignore customNumbers

		text = text.replace(/^\d{6}/, ""); // remove MM-Nummer

		if (cleanDashZero(text)) continue; // ignore DashZero
		text = text.split("[")[0].trim(); // remove trailing [xx]

		const obj = {
			[mmID]: id,
			[count]: 1,
			[name]: text,
		};
		if (objectListCAD[id] === undefined) {
			objectListCAD[id] = obj;
		} else {
			objectListCAD[id][count]++;
		}
	}
	fileIsParsed("CAD");
}

function fileIsParsed(type) {
	filesParsed[type] = true;
	const count = type == "SOU" ? KadUtils.objectLength(objectListSOU) : KadUtils.objectLength(objectListCAD);
	KadUtils.dbID(`idLbl_loaded${type}`).textContent = `${count} Teile geladen`;
	KadUtils.dbIDStyle(`idLbl_input${type}`).backgroundColor = "limegreen";

	if (filesParsed.SOU && filesParsed.CAD) {
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
	if (id % 10 != 0) return false;
	return filterFamily.includes("Baugruppe");
}
function cleanCustomNumbers(id) {
	if (customNumbers == null) return false;
	let s = customNumbers.includes(Number(id));
	return s;
}
function cleanDashZero(text) {
	if (!stateDashZero) return false;
	return text.trim().substring(0, 2) === "-0";
}

// -----------------------------
function startCompare() {
	objectListCompared = {};
	dataDiff = [];
	dataComp = [];
	let objectNotInCAD = {};
	let objectNotInSOU = {};
	dataNotInCAD = [];
	dataNotInSOU = [];

	for (let [souKey, souValue] of Object.entries(objectListSOU)) {
		const cadCount = objectListCAD[souKey] == null ? 0 : objectListCAD[souKey][count];
		objectListCompared[souKey] = {
			[mmID]: souValue[mmID],
			SOU: souValue[count],
			CAD: cadCount,
			[name]: souValue[name],
			[partFamily]: souValue[partFamily] ? souValue[partFamily] : "---",
			[foundInSOU]: true,
			[foundInCAD]: cadCount == 0 ? false : true,
		};
		if (cadCount == 0) objectNotInCAD[souKey] = objectListCompared[souKey];
	}

	for (let [cadKey, cadValue] of Object.entries(objectListCAD)) {
		if (objectListCompared[cadKey] === undefined) {
			objectListCompared[cadKey] = {
				[mmID]: cadValue[mmID],
				SOU: 0,
				CAD: cadValue[count],
				[name]: cadValue[name],
				[partFamily]: "aus CAD",
				[foundInSOU]: false,
				[foundInCAD]: true,
			};
			objectNotInSOU[cadKey] = objectListCompared[cadKey];
		}
	}

	objectListDifferences = Object.values(objectListCompared).filter((obj) => obj.SOU != obj.CAD);

	dataDiff = objectToArray(objectListDifferences);
	dataComp = objectToArray(objectListCompared);
	dataNotInSOU = objectToArray(objectNotInSOU);
	dataNotInCAD = objectToArray(objectNotInCAD);

	dataDiff.sort((a, b) => a[0] - b[0]);
	dataComp.sort((a, b) => a[0] - b[0]);
	dataNotInSOU.sort((a, b) => a[0] - b[0]);
	dataNotInCAD.sort((a, b) => a[0] - b[0]);

	KadUtils.dbID(idLbl_errorsFound).textContent = dataDiff.length;
	KadUtils.dbID(idLbl_missingSOU).textContent = dataNotInSOU.length;
	KadUtils.dbID(idLbl_missingCAD).textContent = dataNotInCAD.length;

	KadUtils.KadDOM.enableBtn(idBtn_download, true);
}

function objectToArray(obj) {
	let arr = [];
	for (let [index, listItem] of Object.values(obj).entries()) {
		arr[index] = [];
		for (let h of parsedHeader) {
			arr[index].push(listItem[h]);
		}
	}
	return arr;
}

function startDownload() {
	refreshParsing();

	dataDiff.unshift(parsedHeader);
	dataComp.unshift(parsedHeader);
	dataNotInSOU.unshift(parsedHeader);
	dataNotInCAD.unshift(parsedHeader);

	const book = utils.book_new();
	let sheetDiff = utils.aoa_to_sheet(dataDiff);
	let sheetComp = utils.aoa_to_sheet(dataComp);
	let sheetSOU = utils.aoa_to_sheet(dataNotInSOU);
	let sheetCAD = utils.aoa_to_sheet(dataNotInCAD);
	utils.book_append_sheet(book, sheetDiff, "Differenz");
	utils.book_append_sheet(book, sheetComp, "Alles");
	utils.book_append_sheet(book, sheetSOU, "Nicht im SOU");
	utils.book_append_sheet(book, sheetCAD, "Nicht im CAD");
	let name = filename || "Stücklistenvergleich";
	writeFile(book, `${name}.xlsx`);
}
