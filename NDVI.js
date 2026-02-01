// ============================
// Sentinel-2 NDVI + Classification (INDIA)
// Google Earth Engine Script
// ============================

// 1) India boundary
var countries = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
var india = countries.filter(ee.Filter.eq('country_na', 'India'));

Map.centerObject(india, 5);
Map.addLayer(india, {color: "yellow"}, "India Boundary");

// 2) Date range
var startDate = "2024-01-01";
var endDate   = "2024-12-31";

// 3) Cloud mask function (Sentinel-2 SR)
function maskS2clouds(image) {
  // Scene Classification Layer
  var scl = image.select("SCL");

  // Remove cloud, shadow, cirrus
  var mask = scl.neq(3)   // cloud shadow
    .and(scl.neq(8))      // cloud (medium)
    .and(scl.neq(9))      // cloud (high)
    .and(scl.neq(10));    // cirrus

  return image.updateMask(mask);
}

// 4) Load Sentinel-2 SR Harmonized
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(india)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
  .map(maskS2clouds);

// 5) Median composite
var composite = s2.median().clip(india);

// 6) NDVI calculation (NIR=B8, RED=B4)
var ndvi = composite
  .normalizedDifference(["B8", "B4"])
  .rename("NDVI");

// NDVI visualization
var ndviVis = {
  min: -0.2,
  max: 0.9,
  palette: ["blue", "white", "green"]
};

Map.addLayer(ndvi, ndviVis, "NDVI (Sentinel-2)");

// 7) NDVI-based classification (rule-based)
// Classes:
// 1 = Water
// 2 = Bare soil / Built-up
// 3 = Sparse vegetation
// 4 = Dense vegetation

var ndviClass = ndvi.expression(
  "b('NDVI') < 0.0 ? 1" +        // Water
  ": b('NDVI') < 0.2 ? 2" +      // Bare / Built-up
  ": b('NDVI') < 0.5 ? 3" +      // Sparse vegetation
  ": 4"                          // Dense vegetation
).rename("NDVI_Class")
 .clip(india);

// Classification visualization
var classVis = {
  min: 1,
  max: 4,
  palette: [
    "#1f78b4", // Water
    "#b15928", // Bare soil / Built-up
    "#a6d854", // Sparse vegetation
    "#006400"  // Dense vegetation
  ]
};

Map.addLayer(ndviClass, classVis, "NDVI Classification (India)");

// ============================
// Legend for NDVI Classification
// ============================

var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    backgroundColor: 'white'
  }
});

var legendTitle = ui.Label({
  value: 'NDVI Classification Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 8px 0'
  }
});
legend.add(legendTitle);

function makeRow(color, name) {
  var colorBox = ui.Label('', {
    backgroundColor: color,
    padding: '8px',
    margin: '0 0 6px 0'
  });

  var desc = ui.Label(name, {
    margin: '0 0 6px 8px',
    fontSize: '12px'
  });

  return ui.Panel({
    widgets: [colorBox, desc],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}

var classNames = [
  "1  Water (NDVI < 0.0)",
  "2  Bare soil / Built-up (0.0–0.2)",
  "3  Sparse vegetation (0.2–0.5)",
  "4  Dense vegetation (> 0.5)"
];

var classColors = [
  "#1f78b4",
  "#b15928",
  "#a6d854",
  "#006400"
];

for (var i = 0; i < classNames.length; i++) {
  legend.add(makeRow(classColors[i], classNames[i]));
}

Map.add(legend);
