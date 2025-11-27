async function drawPyramidTrend() {
    const data = await d3.csv("data/police_enforcement_2024_fines.csv", d3.autoType);

    // Filter for speeding
    const filtered = data.filter(d => d.METRIC === "speed_fines");

    // Aggregate per year
    const yearly = d3.rollups(
        filtered,
        v => {
            const fines = d3.sum(v, d => d.FINES);
            const severe = d3.sum(v, d => d.ARRESTS) + d3.sum(v, d => d.CHARGES);
            return {
                fines: fines / 1000,
                severe: severe / 1000,
                finesRaw: fines,
                severeRaw: severe
            };
        },
        d => d.YEAR
    )
    .map(([year, v]) => ({ year: +year, ...v }))
    .sort((a,b) => d3.ascending(a.year, b.year));

    // SVG setup
    const container = d3.select("#viz-temporal-trend");
    const width = container.node().clientWidth || 700;
    const height = 450;

    const margin = { top: 30, right: 40, bottom: 50, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .domain(yearly.map(d => d.year))
        .range([0, chartWidth])
        .padding(0.3);

    const maxValue = d3.max(yearly, d => d.severe + d.fines);
    const y = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .range([chartHeight, 0]);

    // Stack data: severe on top, fines on bottom
    const stack = d3.stack()
        .keys(["fines", "severe"]);

    const stackedData = stack(yearly);

    // Create tooltip
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

    // Draw stacked bars
    const color = d3.scaleOrdinal()
        .domain(["fines", "severe"])
        .range(["#3182bd", "#e6550d"]);

    g.selectAll("g.layer")
        .data(stackedData)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => x(d.data.year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("opacity", 0.85)
        .on("mouseover", function(event, d) {
            const isSecond = d3.select(this.parentNode).datum().key === "severe";
            const rawValue = isSecond ? d.data.severeRaw : d.data.finesRaw;
            const label = isSecond ? "Severe (Arrests+Charges)" : "Fines";
            const per1000Value = isSecond ? d.data.severe : d.data.fines;

            tooltip.style("display", "block")
                .html(`<strong>Year:</strong> ${d.data.year}<br/>
                       <strong>${label}:</strong><br/>
                       Raw: ${rawValue.toLocaleString()}<br/>
                       Per 1000: ${per1000Value.toFixed(2)}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    // X axis
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .append("text")
        .attr("x", chartWidth / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Year");

    // Y axis
    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (chartHeight / 2))
        .attr("dy", "1em")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .text("Count per 1000");

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left + chartWidth - 150}, ${margin.top})`);

    const items = [
        { label: "Fines", color: "#3182bd" },
        { label: "Severe (Arrests+Charges)", color: "#e6550d" }
    ];

    items.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i*20})`);
        row.append("rect").attr("width", 14).attr("height", 14).attr("fill", d.color);
        row.append("text").attr("x", 20).attr("y", 12).style("font-size", "12px").text(d.label);
    });
}

drawPyramidTrend();