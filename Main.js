import * as KadUtils from "./Data/KadUtils.js";
import { utils, read, writeFile } from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

window.onload = mainSetup;

function mainSetup() {
	console.log("hello");
	KadUtils.KadDOM.resetInput(idVin_customerNumber, "133438", { min: 0, max: 999999 }); //Beistellnummer
	KadUtils.daEL(idVin_customerNumber, "input", getCustomerNumber);
	KadUtils.daEL(idVin_SOUInput, "change", (evt) => getFile(evt, "SOU"));
	KadUtils.daEL(idVin_textInput, "change", (evt) => getFile(evt, "TEXT"));
	KadUtils.daEL(idBtn_compare, "click", startCompare);
}

const mmID = "ArtikelNr";
const count = "Menge";
const name = "Bezeichnung";
const partFamily = "ArtikelTeileFamilie";
const filterFamily = ["Rohmaterial", "Baugruppe"];
const parsedHeader = [mmID, count, name, partFamily];

let customerNumber = "";
let objectListSOU = {};
let objectListCAD = {};
let objectListCompared = {};
let filesParsed = {
	SOU: false,
	CAD: false,
};

function getCustomerNumber(data) {
	customerNumber = data.target.valueAsNumber;
	console.log(data.target.valueAsNumber);
}

function getFile(evt, type) {
	let selectedFile = evt.target.files[0];
	let fileReader = new FileReader();
	if (type == "SOU") {
		fileReader.onload = (event) => parseExcelFile(event.target.result);
		fileReader.readAsBinaryString(selectedFile);
	}

	if (type == "TEXT") {
		fileReader.onload = (event) => parseTextFile(event.target.result.split(/\r?\n/));
		fileReader.readAsText(selectedFile);
	}
}

function parseExcelFile(data) {
	let workbook = read(data, { type: "binary" });
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
		console.log(objectListSOU);
		filesParsed.SOU = true;
	});
}

function parseTextFile(data) {
	objectListCAD = {};
	let lastDepth = -1;
	let lastDepthID = null;
	for (let row of data) {
		// if row is empty --> igrnore
		if (row.trim() == "") continue;
		const depth = row.search(/\S|$/) / 3;

		let text = row.trimStart().slice(3); // remove "|--"

		// if row is created by a drawing --> igrnore
		if (cleanDrawings(text)) continue;

		// get MM-Nummer
		const id = Number(text.slice(0, 6));
		// if MM-Nummer is NaN --> ignore
		if (Number.isNaN(id)) continue;

		// initialize depth
		if (lastDepthID == null) {
			lastDepth = depth;
			lastDepthID = id;
		}
		if (depth > lastDepth) {
			if (id == lastDepthID) continue;
			lastDepth = depth;
		}
		if (depth < lastDepth) lastDepth = depth;

		if (id == customerNumber) continue;

		// if filter "Baugruppe" is active --> ignore
		if (id % 10 == 0 && filterFamily.includes("Baugruppe")) continue;

		// remove MM-Nummer from string
		text = text.replace(/^[0-9]{6}/, "");

		//get amount from "Exemplare"
		let amount = text.match(/\([0-9]{1,}\)$/);
		amount = amount === null ? 1 : Number(amount[0].replace(/\(|\)/g, ""));
		text = text.split("[")[0].trim();

		const obj = {
			[mmID]: id,
			[count]: amount,
			[name]: text,
		};
		if (objectListCAD[id] === undefined) {
			objectListCAD[id] = obj; // objectListSOU[id][mmID] = id; // format as String with leading 0
		} else {
			objectListCAD[id][count] += amount;
		}
    // works only because the numbers are sorted and will not be interrupted by other ids
		lastDepthID = id;
	}
	filesParsed.CAD = true;
}

function cleanDrawings(text) {
	return text.trim().match(/^\([0-9]{1,}\)/);
}

function startCompare() {
	if (!filesParsed.SOU || !filesParsed.CAD) {
		alert("Fehler!");
		return;
	}
	console.log("COMPARE");
	compareLists();
	// createFile();
}

function compareLists() {
	let arrayListSOU = [];
	let arrayListCAD = [];

	// check if SOU --> CAD; get difference in amount --> if > 0 --> add to list "arrayListSOU"
	for (let [souKey, souValue] of Object.entries(objectListSOU)) {
		let cadObj = objectListCAD[souKey];
		if (cadObj == null) {
			// if (!objectListCAD.hasOwnProperty(souKey)) {
			// ist im Sou aber nicht im CAD
			arrayListSOU.push(souValue);
		} else {
			console.log(souKey, souValue[count], cadObj[count], souValue[count] - cadObj[count]);
			if (souValue[count] - cadObj[count]) console.error("ERROR");
			// arrayListCAD.push(souValue);
			// } else {
		}
	}
	// for (let cadKey in objectListCAD) {
	// 	console.log("CAD -> SOU", cadKey, objectListSOU.hasOwnProperty(cadKey));
	// }
	console.log(arrayListSOU, arrayListCAD);
}

function createFile() {
	let wbArray = [];
	console.log(objectListCompared);
	for (let [index, listItem] of Object.values(objectListCompared).entries()) {
		wbArray[index] = [];
		for (let h of parsedHeader) {
			wbArray[index].push(listItem[h]);
		}
	}
	wbArray.unshift(parsedHeader);
	console.log(wbArray);
	let wb = utils.book_new();
	let ws = utils.aoa_to_sheet(wbArray);
	utils.book_append_sheet(wb, ws, "Differenzen");
	writeFile(wb, "Stücklistenvergleich.xlsx");
}
