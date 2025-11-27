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
    chargesPerFine: d3.sum(v, d => +d.CHARGES) / d3.sum(v, d => +d.FINES),
    arrests: d3.sum(v, d => +d.ARRESTS),
    charges: d3.sum(v, d => +d.CHARGES),
    fines: d3.sum(v, d => +d.FINES)
    }),
    d => d.METRIC
);

// Convert to array of objects for D3
let chartData = offences.map(d => ({
    offence: d[0],
    arrestsPerFine: d[1].arrestsPerFine,
    chargesPerFine: d[1].chargesPerFine,
    arrests: d[1].arrests,
    charges: d[1].charges,
    fines: d[1].fines
}));

// Filter to only show specified metrics
chartData = chartData.filter(d => 
    d.offence === "non_wearing_seatbelts" || 
    d.offence === "speed_fines" || 
    d.offence === "unlicensed_driving"
);

// Sort in consistent order
const metricOrder = ["speed_fines", "non_wearing_seatbelts", "unlicensed_driving"];
chartData.sort((a, b) => metricOrder.indexOf(a.offence) - metricOrder.indexOf(b.offence));

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
    .range(["#e6550d", "#31a354"]); // Orange for arrests, Green for charges

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "chart-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("font-size", "12px")
    .style("border-radius", "4px")
    .style("display", "none");

// X axis
svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
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
    .data(d => subgroups.map(key => ({ key: key, value: d[key], metric: d.offence, arrests: d.arrests, charges: d.charges, fines: d.fines })))
    .enter()
    .append("rect")
    .attr("x", d => x1(d.key))
    .attr("y", d => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", d => color(d.key))
    .attr("opacity", 0.85)
    .on("mouseover", function(event, d) {
        const label = d.key === "arrestsPerFine" ? "Arrests" : "Charges";
        const rawValue = d.key === "arrestsPerFine" ? d.arrests : d.charges;
        tooltip.style("display", "block")
            .html(`<strong>${d.metric.replace(/_/g, " ").toUpperCase()}</strong><br/>
                   <strong>${label} per Fine:</strong> ${d.value.toFixed(4)}<br/>
                   <strong>Raw ${label}:</strong> ${rawValue.toLocaleString()}<br/>
                   <strong>Total Fines:</strong> ${d.fines.toLocaleString()}`)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY + 12) + "px");
    })
    .on("mouseout", () => tooltip.style("display", "none"));

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