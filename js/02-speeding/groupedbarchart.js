// Scatter plot comparison: Speed Fines vs Other Metrics
d3.csv("data/police_enforcement_2024_fines.csv").then(data => {
    
    // Aggregate by METRIC
    const metricsData = d3.rollups(
        data,
        v => ({
            fines: d3.sum(v, d => +d.FINES),
            arrests: d3.sum(v, d => +d.ARRESTS),
            charges: d3.sum(v, d => +d.CHARGES)
        }),
        d => d.METRIC
    )
    .map(([metric, values]) => ({
        metric,
        ...values
    }));

    // Separate speed_fines from others
    const speedFinesData = metricsData.find(d => d.metric === "speed_fines");
    const otherMetrics = metricsData.filter(d => d.metric !== "speed_fines");

    // Prepare scatter plot data
    const scatterData = otherMetrics.map(d => ({
        metric: d.metric,
        fines: d.fines,
        arrests: d.arrests,
        charges: d.charges,
        speedFines: speedFinesData.fines,
        speedArrests: speedFinesData.arrests,
        speedCharges: speedFinesData.charges
    }));

    // SVG setup
    const margin = { top: 50, right: 40, bottom: 80, left: 70 };
    const containerWidth = d3.select("#viz-offence-comparison").node().clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const container = d3.select("#viz-offence-comparison");
    container.html(""); // Clear placeholder

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom);

    // Create two scatter plots side by side
    const plotWidth = (width / 2) - 20;

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

    // Color scales
    const colorArrest = "#e6550d"; // Orange for arrests
    const colorCharge = "#31a354"; // Green for charges

    // Plot 1: Speed Fines (reference)
    const g1 = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x1 = d3.scaleLinear()
        .domain([0, d3.max(scatterData, d => d.speedFines)])
        .range([0, plotWidth]);

    const y1 = d3.scaleLinear()
        .domain([0, d3.max([
            d3.max(scatterData, d => d.speedArrests),
            d3.max(scatterData, d => d.speedCharges)
        ])])
        .range([height, 0]);

    // Speed Fines - Arrests
    g1.selectAll(".arrests-speed")
        .data(scatterData)
        .enter()
        .append("circle")
        .attr("class", "arrests-speed")
        .attr("cx", d => x1(d.speedFines))
        .attr("cy", d => y1(d.speedArrests))
        .attr("r", 6)
        .attr("fill", colorArrest)
        .attr("opacity", 0.7)
        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
                .html(`<strong>Speed Fines</strong><br/>
                       Metric: ${d.metric}<br/>
                       Fines: ${d.speedFines.toLocaleString()}<br/>
                       Arrests: ${d.speedArrests.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // Speed Fines - Charges
    g1.selectAll(".charges-speed")
        .data(scatterData)
        .enter()
        .append("circle")
        .attr("class", "charges-speed")
        .attr("cx", d => x1(d.speedFines))
        .attr("cy", d => y1(d.speedCharges))
        .attr("r", 6)
        .attr("fill", colorCharge)
        .attr("opacity", 0.7)
        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
                .html(`<strong>Speed Fines</strong><br/>
                       Metric: ${d.metric}<br/>
                       Fines: ${d.speedFines.toLocaleString()}<br/>
                       Charges: ${d.speedCharges.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // Axes for plot 1
    g1.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x1))
        .selectAll("text")
        .style("font-size", "11px");

    g1.append("text")
        .attr("x", plotWidth / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Speed Fines");

    g1.append("g")
        .call(d3.axisLeft(y1))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Arrests / Charges");

    g1.append("text")
        .attr("x", plotWidth / 2)
        .attr("y", -20)
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Speed Fines Comparison");

    // Plot 2: Other Metrics
    const g2 = svg.append("g")
        .attr("transform", `translate(${margin.left + plotWidth + 40}, ${margin.top})`);

    const x2 = d3.scaleLinear()
        .domain([0, d3.max(scatterData, d => d.fines)])
        .range([0, plotWidth]);

    const y2 = d3.scaleLinear()
        .domain([0, d3.max([
            d3.max(scatterData, d => d.arrests),
            d3.max(scatterData, d => d.charges)
        ])])
        .range([height, 0]);

    // Other Metrics - Arrests
    g2.selectAll(".arrests-other")
        .data(scatterData)
        .enter()
        .append("circle")
        .attr("class", "arrests-other")
        .attr("cx", d => x2(d.fines))
        .attr("cy", d => y2(d.arrests))
        .attr("r", 6)
        .attr("fill", colorArrest)
        .attr("opacity", 0.7)
        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
                .html(`<strong>${d.metric}</strong><br/>
                       Fines: ${d.fines.toLocaleString()}<br/>
                       Arrests: ${d.arrests.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // Other Metrics - Charges
    g2.selectAll(".charges-other")
        .data(scatterData)
        .enter()
        .append("circle")
        .attr("class", "charges-other")
        .attr("cx", d => x2(d.fines))
        .attr("cy", d => y2(d.charges))
        .attr("r", 6)
        .attr("fill", colorCharge)
        .attr("opacity", 0.7)
        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
                .html(`<strong>${d.metric}</strong><br/>
                       Fines: ${d.fines.toLocaleString()}<br/>
                       Charges: ${d.charges.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // Axes for plot 2
    g2.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x2))
        .selectAll("text")
        .style("font-size", "11px");

    g2.append("text")
        .attr("x", plotWidth / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Fines");

    g2.append("g")
        .call(d3.axisLeft(y2))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Arrests / Charges");

    g2.append("text")
        .attr("x", plotWidth / 2)
        .attr("y", -20)
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Other Offences Comparison");

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left + width/2 - 80}, ${height + margin.top + 50})`);

    const items = [
        { label: "Arrests", color: colorArrest },
        { label: "Charges", color: colorCharge }
    ];

    items.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(${i * 120}, 0)`);
        row.append("circle").attr("r", 6).attr("fill", d.color).attr("opacity", 0.7);
        row.append("text").attr("x", 15).attr("y", 5).style("font-size", "12px").text(d.label);
    });
});