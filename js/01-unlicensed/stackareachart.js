// stackedareachart.js
async function drawTemporalTrend() {
    const data = await d3.csv("data/police_enforcement_2024_fines.csv", d3.autoType);

    // ---- 1. Prepare aggregated data by MONTH ----
    const filteredData = data.filter(d => d.METRIC === "unlicensed_driving");

    const monthly = d3.rollups(
        filteredData,
        v => {
            const fines = d3.sum(v, d => +d.FINES);
            const severe = d3.sum(v, d => +d.ARRESTS) + d3.sum(v, d => +d.CHARGES);
            return { fines, severe };
        },
        d => {
            // Parse START_DATE (format: M/D/YYYY)
            const parts = d.START_DATE.split("/");
            const month = parseInt(parts[0]);
            const year = parseInt(parts[2]);
            return `${year}-${String(month).padStart(2, "0")}`;
        }
    )
    .map(([monthStr, values]) => ({
        month: monthStr,
        date: new Date(monthStr + "-01"),
        ...values
    }))
    .sort((a, b) => a.date - b.date);

    // ---- 2. Stack keys ----
    const keys = ["severe", "fines"];

    const stack = d3.stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

    const series = stack(monthly);

    // ---- 3. SVG container ----
    const container = d3.select("#viz-temporal-trend");
    const width = container.node().clientWidth;
    const height = 350;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const margin = { top: 30, right: 55, bottom: 40, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // ---- 4. Scales ----
    const x = d3.scaleTime()
        .domain(d3.extent(monthly, d => d.date))
        .range([0, chartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(monthly, d => d.fines + d.severe)])
        .range([chartHeight, 0]);

    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#31A354", "#6BAED6"]);

    // ---- 5. Tooltip ----
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

    // ---- 6. Area generator ----
    const area = d3.area()
        .x(d => x(d.data.date))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    // ---- 7. Draw layers ----
    g.selectAll(".layer")
        .data(series)
        .join("path")
        .attr("class", "layer")
        .attr("d", area)
        .attr("fill", d => color(d.key))
        .attr("opacity", d => d.key === "fines" ? 0.45 : 0.85);

    // ---- 8. Add interactive overlay for tooltip ----
    g.append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousemove", function(event) {
            const [xMouse] = d3.pointer(event, this);
            const dateHover = x.invert(xMouse);
            
            // Find closest month
            let closest = monthly[0];
            let minDiff = Math.abs(dateHover - closest.date);
            
            for (let d of monthly) {
                const diff = Math.abs(dateHover - d.date);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = d;
                }
            }
            
            const finesValue = closest.fines;
            const severeValue = closest.severe;
            const totalValue = finesValue + severeValue;
            
            tooltip.style("display", "block")
                .html(`<strong>Month: ${closest.month}</strong><br/>
                       <strong>FINES:</strong> ${finesValue.toLocaleString()}<br/>
                       <strong>SEVERE (Arrests + Charges):</strong> ${severeValue.toLocaleString()}<br/>
                       <strong>Total:</strong> ${totalValue.toLocaleString()}`)
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
        });

    // ---- 9. Axes ----
    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth).tickFormat(d3.timeFormat("%m/%y")));

    g.append("g")
        .call(d3.axisLeft(y));
        
    // ---- 10. Legend ----
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left},10)`);

    ["FINES", "SEVERE"].forEach((label, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(${i * 120},0)`);

        row.append("rect")
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", color(label.toLowerCase()));

        row.append("text")
            .attr("x", 22)
            .attr("y", 13)
            .text(label);
    });
}

drawTemporalTrend();