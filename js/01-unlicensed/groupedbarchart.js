// Set chart dimensions
const margin = { top: 50, right: 30, bottom: 100, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#viz-offence-comparison")
.html("") // clear placeholder text
.append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom)
.append("g")
.attr("transform", `translate(${margin.left},${margin.top})`);

// Load CSV
d3.csv("data/police_enforcement_2024_fines.csv").then(data => {

// Aggregate data by METRIC (offence type)
const offences = d3.rollups(
    data,
    v => ({
    arrestsPerFine: d3.sum(v, d => +d.ARRESTS) / d3.sum(v, d => +d.FINES),
    chargesPerFine: d3.sum(v, d => +d.CHARGES) / d3.sum(v, d => +d.FINES)
    }),
    d => d.METRIC
);

// Convert to array of objects for D3
const chartData = offences.map(d => ({
    offence: d[0],
    arrestsPerFine: d[1].arrestsPerFine,
    chargesPerFine: d[1].chargesPerFine
}));

const subgroups = ["arrestsPerFine", "chargesPerFine"];
const groups = chartData.map(d => d.offence);

// X scale
const x0 = d3.scaleBand()
    .domain(groups)
    .range([0, width])
    .padding(0.2);

const x1 = d3.scaleBand()
    .domain(subgroups)
    .range([0, x0.bandwidth()])
    .padding(0.05);

// Y scale
const y = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => Math.max(d.arrestsPerFine, d.chargesPerFine)) * 1.1])
    .range([height, 0]);

// Color scale
const color = d3.scaleOrdinal()
    .domain(subgroups)
    .range(["#1f77b4", "#ff7f0e"]);

// X axis
svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

// Y axis
svg.append("g")
    .call(d3.axisLeft(y));

// Bars
svg.selectAll("g.bar-group")
    .data(chartData)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.offence)},0)`)
    .selectAll("rect")
    .data(d => subgroups.map(key => ({ key: key, value: d[key] })))
    .enter()
    .append("rect")
    .attr("x", d => x1(d.key))
    .attr("y", d => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", d => color(d.key));

// Legend
const legend = svg.selectAll(".legend")
    .data(subgroups)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`);

legend.append("rect")
    .attr("x", width - 18)
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", d => color(d));

legend.append("text")
    .attr("x", width - 24)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("text-anchor", "end")
    .text(d => d === "arrestsPerFine" ? "Arrests per Fine" : "Charges per Fine");
});