document.addEventListener("DOMContentLoaded", function() {
    const containerId = "#viz-detection-method";
    const container = document.querySelector(containerId);

    if (!container) return;

    container.innerHTML = "";

    const margin = { top: 40, right: 120, bottom: 20, left: 20 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axis Labels
    svg.append("text").attr("x", 0).attr("y", -15).attr("font-weight", "bold").text("Detection Method");
    svg.append("text").attr("x", width).attr("y", -15).attr("text-anchor", "end").attr("font-weight", "bold").text("Enforcement Outcome");

    d3.csv("data/police_enforcement_2024_fines.csv").then(function(data) {
        
        // 1. Filter for Speeding
        const metricData = data.filter(d => d.METRIC === "speed_fines");

        // 2. Aggregate Data
        let stats = {
            "Camera-based": { fines: 0, arrests: 0, charges: 0 },
            "Police-issued": { fines: 0, arrests: 0, charges: 0 }
        };

        metricData.forEach(d => {
            const method = d.DETECTION_METHOD;
            const fines = +d.FINES || 0;
            const arrests = +d.ARRESTS || 0;
            const charges = +d.CHARGES || 0;

            let category = null;
            if (method.includes("Police")) category = "Police-issued";
            else if (method.toLowerCase().includes("camera")) category = "Camera-based";

            if (category) {
                stats[category].fines += fines;
                stats[category].arrests += arrests;
                stats[category].charges += charges;
            }
        });

        // 3. Construct Nodes and Links
        const nodes = [
            { name: "Camera-based" },
            { name: "Police-issued" },
            { name: "Fines" },
            { name: "Arrests" },
            { name: "Charges" }
        ];

        const links = [];
        const categories = ["Camera-based", "Police-issued"];
        const outcomes = ["fines", "arrests", "charges"];
        const outcomeIndices = { "fines": 2, "arrests": 3, "charges": 4 };

        categories.forEach((cat, i) => {
            outcomes.forEach(outcome => {
                const value = stats[cat][outcome];
                if (value > 0) links.push({ source: i, target: outcomeIndices[outcome], value: value });
            });
        });

        // 4. Setup Sankey (Alluvial Style)
        const sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(20)
            .extent([[1, 1], [width - 1, height - 6]])
            .nodeSort((a, b) => b.value - a.value);

        const { nodes: graphNodes, links: graphLinks } = sankey({
            nodes: nodes.map(d => Object.assign({}, d)),
            links: links.map(d => Object.assign({}, d))
        });

        // Tooltip
        const tooltip = d3.select("body").append("div").attr("class", "d3-tooltip");
        const restoreOpacity = () => {
            d3.selectAll("path").transition().duration(200).attr("stroke-opacity", 0.4);
            tooltip.transition().duration(500).style("opacity", 0);
        };

        // 5. Draw Links
        const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .selectAll("g")
            .data(graphLinks)
            .join("g")
            .style("mix-blend-mode", "multiply");

        const linkPath = link.append("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => d.source.name === "Camera-based" ? "#1976D2" : "#D32F2F")
            .attr("stroke-width", d => Math.max(1, d.width));

        linkPath.on("mouseover", function(event, d) {
            d3.selectAll("path").attr("stroke-opacity", 0.1);
            d3.select(this).attr("stroke-opacity", 0.8);
            const percent = ((d.value / d.source.value) * 100).toFixed(1);
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.source.name} → ${d.target.name}</strong><br/>${d.value.toLocaleString()} instances<br/><span style="color:red">(${percent}% of ${d.source.name})</span>`)
                .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        }).on("mouseout", restoreOpacity);

        // 6. Draw Nodes
        const node = svg.append("g")
            .selectAll("rect")
            .data(graphNodes)
            .join("rect")
            .attr("x", d => d.x0).attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0).attr("width", d => d.x1 - d.x0)
            .attr("fill", d => (d.name === "Camera-based" ? "#1976D2" : (d.name === "Police-issued" ? "#D32F2F" : "#555")))
            .attr("opacity", 0.9);

        node.on("mouseover", function(event, d) {
            d3.selectAll("path").transition().duration(200).attr("stroke-opacity", l => (l.source === d || l.target === d) ? 0.8 : 0.05);
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.name}</strong><br/>Total: ${d.value.toLocaleString()}`)
                .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        }).on("mouseout", restoreOpacity);

        // 7. Labels
        svg.append("g").attr("font-family", "sans-serif").attr("font-size", 12)
            .selectAll("text").data(graphNodes).join("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2).attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name).attr("font-weight", "bold").attr("fill", "#333");

    }).catch(error => { console.error(error); container.innerHTML = `<div class="map-error">Error: ${error.message}</div>`; });
});