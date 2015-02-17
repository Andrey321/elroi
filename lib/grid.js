(function(elroi, $) {

    /**
     * This function creates the grid that is used by the graph
     * @param {graph} graph The graph object defined by elroi
     * @return {function} draw Draws the grid, x-axis, and y-axes
     */
    function grid(graph) {

        /**
         * Goes through the first series in a data set and creates a set of labels for the x-axis
         * @param data All series to be graphed
         * @param {String} dateFormat
         * @return {Array} xLabels An array of correctly formatted labels for the x-axis
         */
        function getXLabels(series, dateOptions) {

            var xLabels = [];

            $(series).each(function() {
                var label,
                    startDate,
                    endDate;

                if (this.startDate) {
                    startDate = new Date(this.startDate);
                }

                if (this.endDate || this.date) {
                    endDate = this.endDate ? new Date(this.endDate) : this.date;
                }

                label = elroi.fn.formatDateRange(dateOptions.format, startDate, endDate, dateOptions);

                xLabels.push(label);
            });

            return xLabels;
        }

        /**
         * Draws the gridlines based on graph.grid.numYLabels
         */
        function drawGrid() {
            //draw the gridlines
            var i, y,
                gridLine,
                gridLines = graph.paper.set(),
                avalaibleArea = graph.height - graph.padding.top - graph.padding.bottom;

            if (graph.options.grid.show) {
                for (i = 0; i < graph.options.grid.numYLabels; i++) {
                    y = graph.height -
                        i / (graph.options.grid.numYLabels - 1) * avalaibleArea -
                        graph.padding.bottom +
                        graph.padding.top;
                    gridLine = graph.paper.path("M0" + " " + y + "L" + graph.width + " " + y).attr('stroke', '#ddd');
                    gridLines.push(gridLine);
                }
            } else if (graph.options.grid.showBaseline) {
                y = graph.height -
                    graph.padding.bottom +
                    graph.padding.top;
                gridLine = graph.paper.path("M0" + " " + y + "L" + graph.width + " " + y).attr('stroke', '#ddd');
                gridLines.push(gridLine);
            }

            graph.grid = {
                lines: gridLines
            };
        }

        /**
         * Draws the x-axis
         * @param axis An axis object as defined in the elroi options
         */
        function drawXLabels(axis) {

            var $labels, axisY;

            if (axis.id === 'x1') {
                axisY = graph.height;
            } else if (axis.id === 'x2') {
                axisY = graph.padding.top;
            }

            if (axis.customXLabel) {
                $labels = $(axis.customXLabel);
            } else {

                $labels = $('<ul></ul>')
                    .addClass('x-ticks')
                    .addClass(axis.id);

                $(axis.labels).each(function(i) {
                    if (i % graph.showEvery === 0) {
                        var x = i * graph.xTick + graph.padding.left;
                        var label = (axis.labels[i].replace(/^\s+|\s+$/g, '') || '');

                        $('<li></li>')
                            .css({top: axisY, left: x})
                            .html(label)
                            .appendTo($labels);
                    }
                });
            }


            // Get those labels centered relative to their bar
            $labels.find('li').each(function() {
                var $label = $(this);
                var x = parseInt($label.css('left'), 10) + ($label.width())/2;

                $label.css({ left: x, width: graph.labelWidth });

                if (axis.id === 'x2') {
                    $label.css( { top: axisY + $labels.height() + graph.padding.top });
                }
            });

            $labels.appendTo(graph.$el);

        }

        /**
         * Takes in a maximum value and a precision level, and returns an array of numbers for use in the y label
         *
         * @param {number} maxVal The maximum value in a dataset
         * @param {number} precision The number of digits to show
         * @return {Array} yLabels A set of labels for the y axis
         */
        function getYLabels(maxVal, minVal, precision) {
            var yLabels = [],
                i;

            for (i = 0; i < graph.options.grid.numYLabels; i++) {

                var yLabel = i / (graph.options.grid.numYLabels-1) * (maxVal - minVal) + minVal;

                yLabel = (yLabel === 0) ? '0' : yLabel.toFixed(precision); /* Don't show 0.00... ever */

                // (-.23).toFixed(0) will produce '-0', which we don't want
                yLabel = yLabel === '-0' ? '0' : yLabel;

                yLabels.push(yLabel);

            }
            return yLabels;
        }

        // visible for testing
        elroi.fn.helpers.getYLabels = getYLabels;

        /**
         * This draws either the y1 or y2 axis, depending on the series data
         * @param {object} The axis for witch labels should be drawn.
         */
        function drawYLabels(axis) {

            // Draw the y labels
            var $yLabels = $('<ul></ul>')
                .addClass("y-ticks")
                .addClass(axis.id);

            var maxVal = graph.maxVals[axis.seriesIndex],
                minVal = graph.minVals[axis.seriesIndex],
                precision = graph.options.precision;

            // The graph can contain only small values and scale ratio can be less than one
            // (more than one pixel is used per a value unit). And in combination with zero precision this can leads
            // to situation when labels with fractional numbers are too over-aggressively rounded and it looks confusing.
            // So in that case precision will be increased.
            if (precision === 0
                // scale ratio check
                && graph.yTicks[axis.seriesIndex] > 1
                // labels contain fractional numbers check
                && ((maxVal + Math.abs(minVal)).toFixed(0) % (graph.options.grid.numYLabels - 1)) !== 0) {

                precision++;
            }

            var thousandsSeparator = graph.options.thousandsSeparator,
                decimalSeparator = graph.options.decimalSeparator,
                yLabels = getYLabels(maxVal, minVal, precision),
                avalaibleArea = graph.height - graph.padding.top - graph.padding.bottom,
                maxYLabelWidth = 0;

            //When using dynamic padding, provide an additional 3px cushion so text doesn't butt up against content
            var MINIMUM_LEFT_PADDING = 3;

            while(containsDuplicateLabels(yLabels)) {
                precision++;
                yLabels = getYLabels(maxVal, minVal, precision);
            }

            $(yLabels).each(function(i) {
                var yLabel = commaFormat(yLabels[i], precision, thousandsSeparator, decimalSeparator);
                var li;
                var y = graph.height -
                    i / (graph.options.grid.numYLabels - 1) * avalaibleArea -
                    graph.padding.bottom +
                    graph.padding.top -
                    graph.labelLineHeight;

                // Topmost ylabel gets a different unit
                if (i === graph.options.grid.numYLabels-1) {
                    yLabel = graph.options.topLabelFormatter(yLabel,axis);
                } else {
                    yLabel = graph.options.labelFormatter(yLabel,axis);
                }

                // y1 labels go on the left, y2 labels go on the right
                var cssPosition;
                if (axis.id === 'y1') {
                    cssPosition = { 'top' : y, 'left' : 0 };
                }
                if (axis.id === 'y2') {
                    cssPosition = { 'top' : y, 'right' : 0 };
                }

                $('<li></li>')
                    .css(cssPosition)
                    .html(yLabel)
                    .appendTo($yLabels);
            });

            $yLabels.appendTo(graph.$el);

            if (graph.options.dynamicLeftPadding) {
                $yLabels.children().each(function(index, label) {
                    if ($(label).width() > maxYLabelWidth) {
                        maxYLabelWidth = $(label).width();
                    }
                });

                if (graph.padding.left < maxYLabelWidth) {
                    graph.padding.left = maxYLabelWidth + MINIMUM_LEFT_PADDING;
                }
            }
        }

        /**
         * Calls all other draw methods
         */
        function draw() {

            drawGrid();
            var seriesIndex;

            // Can't get any axes if we don't have any data
            if (!graph.hasData) {
                return;
            }

            if (graph.options.axes.y1.show) {
                drawYLabels(graph.options.axes.y1);
            }
            if (graph.options.axes.y2.show) {
                drawYLabels(graph.options.axes.y2);
            }

            if (graph.options.axes.x1.show) {
                if (!graph.options.axes.x1.labels || graph.options.axes.x1.labels.length === 0) {
                    seriesIndex = graph.options.axes.x1.seriesIndex;
                    graph.options.axes.x1.labels= getXLabels(graph.allSeries[seriesIndex].series[0], graph.options.dates);
                }
                drawXLabels(graph.options.axes.x1);
            }
            if (graph.options.axes.x2.show && graph.hasData) {
                if (!graph.options.axes.x2.labels || graph.options.axes.x2.labels.length === 0) {
                    seriesIndex = graph.options.axes.x2.seriesIndex;
                    graph.options.axes.x2.labels = getXLabels(graph.allSeries[seriesIndex].series[0], graph.options.dates);
                }
                drawXLabels(graph.options.axes.x2);
            }

        }

        return {
            draw : draw
        };
    }

    function containsDuplicateLabels(arr) {
        var i, j, n;
        n= arr.length;

        for (i=0; i<n; i++) {
            for (j=i+1; j<n; j++) {
                if (arr[i] === arr[j]) {
                    return true;
                }
            }
        }
        return false;
    }

    // visible for testing
    elroi.fn.helpers.containsDuplicateLabels = containsDuplicateLabels;

    function commaFormat (num, precision, thousandsSeparator, decimalSeparator) {
        var splitNum,
            preDecimal,
            postDecimal,
            rgx = /(\d+)(\d{3})/;

        thousandsSeparator = thousandsSeparator || ' ';
        decimalSeparator = decimalSeparator || ' ';

        /* Don't show 0.00... ever */
        if (num === '0') {
            return '0';
        }

        if (precision) {
            num = parseFloat(num); // Make sure this is a number
            num = precision === 'round' ? Math.round(num) : num.toFixed(precision);
        }

        // stringify it
        num += '';

        splitNum = num.split('.');

        preDecimal = splitNum[0];
        postDecimal = splitNum[1] ? decimalSeparator + splitNum[1] : '';

        while (rgx.test(preDecimal)) {
            preDecimal = preDecimal.replace(rgx, '$1' + thousandsSeparator + '$2');
        }

        return preDecimal + postDecimal;
    }

    // visible for testing
    elroi.fn.helpers.commaFormat = commaFormat;

    elroi.fn.grid = grid;

})(elroi, jQuery);
