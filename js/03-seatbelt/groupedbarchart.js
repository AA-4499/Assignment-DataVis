// Stacked bar chart: Percentage of Arrests vs Charges by Offence Type
d3.csv("data/police_enforcement_2024_fines.csv").then(data => {
    
    // Aggregate by METRIC
    const metricsData = d3.rollups(
        data,
        v => ({
            arrests: d3.sum(v, d => +d.ARRESTS),
            charges: d3.sum(v, d => +d.CHARGES),
            fines: d3.sum(v, d => +d.FINES)
        }),
        d => d.METRIC
    )
    .map(([metric, values]) => {
        const totalSevere = values.arrests + values.charges;
        // Prevent division by zero
        const safeTotal = totalSevere === 0 ? 1 : totalSevere;
        
        return {
            metric,
            // Keep raw counts for tooltip
            arrestsCount: values.arrests,
            chargesCount: values.charges,
            // Normalize values to percentages (0.0 to 1.0) for the chart
            arrests: values.arrests / safeTotal,
            charges: values.charges / safeTotal,
            totalSevere: totalSevere
        };
    });

    // Filter to only show specified metrics
    const chartData = metricsData.filter(d => 
        d.metric === "non_wearing_seatbelts" || 
        d.metric === "speed_fines" || 
        d.metric === "unlicensed_driving"
    );

    // Sort in consistent order
    const metricOrder = ["unlicensed_driving", "speed_fines", "non_wearing_seatbelts"];
    chartData.sort((a, b) => metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric));

    // SVG setup
    const margin = { top: 50, right: 30, bottom: 100, left: 70 };
    const containerWidth = d3.select("#viz-offence-comparison").node().clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const container = d3.select("#viz-offence-comparison");
    container.html(""); // Clear placeholder

    const svg = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .domain(chartData.map(d => d.metric))
        .range([0, width])
        .padding(0.3);

    // Y scale is now fixed to 0% - 100%
    const y = d3.scaleLinear()
        .domain([0, 1])
        .range([height, 0]);

    // Color scale
    const color = d3.scaleOrdinal()
        .domain(["arrests", "charges"])
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

    // Stack data (using the normalized percentage keys)
    const stack = d3.stack()
        .keys(["arrests", "charges"]);

    const stackedData = stack(chartData);

    // Draw stacked bars
    svg.selectAll("g.layer")
        .data(stackedData)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => x(d.data.metric))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("opacity", 0.85)
        .on("mouseover", function(event, d) {
            const key = d3.select(this.parentNode).datum().key; // "arrests" or "charges"
            const pctValue = d[1] - d[0];
            const metric = d.data.metric;
            
            // Retrieve original count based on key
            const count = key === "arrests" ? d.data.arrestsCount : d.data.chargesCount;
            
            tooltip.style("display", "block")
                .html(`<strong>${metric.replace(/_/g, " ").toUpperCase()}</strong><br/>
                       <strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${d3.format(".1%")(pctValue)}<br/>
                       <strong>Count:</strong> ${count.toLocaleString()}<br/>
                       <strong>Total Severe Outcomes:</strong> ${d.data.totalSevere.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // X axis
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickFormat(d => d.replace(/_/g, " ")))
        .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end");

    // Y axis (formatted as percentage)
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

    // Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 20)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Percentage of Severe Outcomes");

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(0, -30)`);

    ["arrests", "charges"].forEach((key, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(${i * 100}, 0)`);

        row.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(key))
            .attr("opacity", 0.85);

        row.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .style("font-size", "12px")
            .text(key.charAt(0).toUpperCase() + key.slice(1));
    });

    // Highlight note for non_wearing seatbelts
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -25)
        .style("text-anchor", "middle")
        .style("font-size", "13px")
        .style("fill", "#e6550d")
        .style("font-weight", "bold")
        .text("(Unlicensed Driving highlighted in first bar)");
});