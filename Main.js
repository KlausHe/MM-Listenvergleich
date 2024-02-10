import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "./Data/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	KadUtils.dbID(idLbl_loadedSOU).textContent = "nicht geladen";
	KadUtils.dbID(idLbl_loadedCAD).textContent = "nicht geladen";
	KadUtils.daEL(idVin_inputSOU, "change", (evt) => getFile(evt, "SOU"));
	KadUtils.daEL(idVin_inputCAD, "change", (evt) => getFile(evt, "TEXT"));

	KadUtils.KadDOM.resetInput(idArea_customNumbers, "MM-Nummern in CAD-Datei ignorieren");
	KadUtils.dbID(idLbl_customNumbers).textContent = "...";
	KadUtils.daEL(idArea_customNumbers, "input", getcustomNumbers);
	stateIgnoreAssembly = KadUtils.KadDOM.resetInput(idCB_ignoreAssembly, true);
	KadUtils.daEL(idCB_ignoreAssembly, "change", ignoreAssemblyFilter);
	stateDashZero = KadUtils.KadDOM.resetInput(idCB_dashZero, false);
	KadUtils.daEL(idCB_dashZero, "change", dashZeroFilter);

	KadUtils.daEL(idBtn_refreshParsing, "click", refreshParsing);

	KadUtils.dbID(idLbl_errorsFound).textContent = "...";
	KadUtils.daEL(idBtn_download, "click", startDownload);
	KadUtils.KadDOM.enableBtn(idBtn_download, false);
}

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const filterFamily = ["Rohmaterial", "Baugruppe"];
const parsedHeader = [mmID, "SOU", "CAD", name, partFamily];

let customNumbers = null;
let stateDashZero = false;
let stateIgnoreAssembly = false;
let filedataSOU = null;
let filedataCAD = null;
let objectListSOU = {};
let objectListCAD = {};
let objectListCompared = {};
let objectListDifferences = {};
let dataDiff = [];
let dataComp = [];
let filesParsed = {
	SOU: false,
	CAD: false,
};

function getcustomNumbers(event) {
	let results = event.target.value;
	customNumbers = results.match(/\d{6}/g);
	let text = "";
	if (customNumbers == null) {
		KadUtils.dbID(idLbl_customNumbers).textContent = "...";
		return;
	}
	customNumbers = customNumbers.map((n) => Number(n));
	text = `${customNumbers.length} Nummern ignoriert:`;
	for (let t of customNumbers) {
		text += `\n ${t}`;
	}
	KadUtils.dbID(idLbl_customNumbers).textContent = text;
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

function getFile(evt, type) {
	let selectedFile = evt.target.files[0];
	let fileReader = new FileReader();
	if (type == "SOU") {
		fileReader.onload = (event) => {
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
	for (let [souKey, souValue] of Object.entries(objectListSOU)) {
		const cadCount = objectListCAD[souKey] == null ? 0 : objectListCAD[souKey][count];
		objectListCompared[souKey] = {
			[mmID]: souValue[mmID],
			SOU: souValue[count],
			CAD: cadCount,
			[name]: souValue[name],
			[partFamily]: souValue[partFamily] ? souValue[partFamily] : "---",
		};
	}

	for (let [cadKey, cadValue] of Object.entries(objectListCAD)) {
		if (objectListCompared[cadKey] === undefined) {
			const souCount = objectListSOU[cadKey] == null ? 0 : objectListSOU[cadKey][count];
			objectListCompared[cadKey] = {
				[mmID]: cadValue[mmID],
				SOU: souCount,
				CAD: cadValue[count],
				[name]: cadValue[name],
				[partFamily]: "aus CAD",
			};
		}
	}

	objectListDifferences = Object.values(objectListCompared).filter((obj) => obj.SOU != obj.CAD);

	dataDiff = [];
	dataComp = [];

	for (let [index, listItem] of Object.values(objectListDifferences).entries()) {
		dataDiff[index] = [];
		for (let h of parsedHeader) {
			dataDiff[index].push(listItem[h]);
		}
	}

	for (let [index, listItem] of Object.values(objectListCompared).entries()) {
		dataComp[index] = [];
		for (let h of parsedHeader) {
			dataComp[index].push(listItem[h]);
		}
	}
	dataDiff.sort((a, b) => a[0] - b[0]);
	dataComp.sort((a, b) => a[0] - b[0]);

	KadUtils.dbID(idLbl_errorsFound).textContent = `${dataDiff.length} Fehler gefunden!`;

	KadUtils.KadDOM.enableBtn(idBtn_download, true);
	console.log(dataDiff, dataComp);
}

function startDownload() {
	refreshParsing();

	dataDiff.unshift(parsedHeader);
	dataComp.unshift(parsedHeader);
	console.log(dataDiff, dataComp);
	const book = utils.book_new();
	let sheetDiff = utils.aoa_to_sheet(dataDiff);
	let sheetComp = utils.aoa_to_sheet(dataComp);
	utils.book_append_sheet(book, sheetDiff, "Differenz");
	utils.book_append_sheet(book, sheetComp, "Alles");
	writeFile(book, "Stücklistenvergleich.xlsx");
}
