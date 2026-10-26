import {
  ARROW_LENGTH,
  ELEMENT_ERASE_THRESHOLD,
  TOOL_ITEMS,
} from "../constants";
import rough from "roughjs/bin/rough";
import { getArrowHeadsCoordinates, isPointCloseToLine } from "./math";
import getStroke from "perfect-freehand";
const gen = rough.generator();
export const createElement = (
  id,
  x1,
  y1,
  x2,
  y2,
  { type, stroke, fill, size },
) => {
  const element = {
    id,
    x1,
    y1,
    x2,
    y2,
    type,
    fill,
    stroke,
    size,
  };
  let options = {
    seed: id + 1,
    fillStyle: "solid",
  };
  if (stroke) {
    options.stroke = stroke;
  }

  if (fill) {
    options.fill = fill;
  }
  if (size) {
    options.strokeWidth = size;
  }

  switch (type) {
    case TOOL_ITEMS.BRUSH: {
      const brushElement = {
        id,
        points: [{ x: x1, y: y1 }],
        path: new Path2D(
          getSvgPathFromStroke(getStroke([{ x: x1, y: y1 }], { size })),
        ),
        type,
        stroke,
        size,
      };
      return brushElement;
    }
    case TOOL_ITEMS.LINE:
      element.roughEle = gen.line(x1, y1, x2, y2, options);
      return element;

    case TOOL_ITEMS.RECTANGLE:
      element.roughEle = gen.rectangle(x1, y1, x2 - x1, y2 - y1, options);
      return element;
    case TOOL_ITEMS.CIRCLE:
      const cx = (x1 + x2) / 2,
        cy = (y1 + y2) / 2;
      const width = x2 - x1,
        height = y2 - y1;
      element.roughEle = gen.ellipse(cx, cy, width, height, options);
      return element;
    case TOOL_ITEMS.ARROW:
      const { x3, y3, x4, y4 } = getArrowHeadsCoordinates(
        x1,
        y1,
        x2,
        y2,
        ARROW_LENGTH,
      );
      const points = [
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x2, y2],
        [x4, y4],
      ];
      element.roughEle = gen.linearPath(points, options);
      return element;
    case TOOL_ITEMS.TEXT:
      element.text = "";
      return element;
    default:
      throw new Error("Type not recognised");
      return undefined;
  }
};

export const isPointNearElement = (element, pointX, pointY) => {
  const { x1, y1, x2, y2, type } = element;
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");
  const eraseThreshold =
    ELEMENT_ERASE_THRESHOLD + Number(element.size || 1) / 2;
  switch (type) {
    case TOOL_ITEMS.LINE:
      return isPointCloseToLine(x1, y1, x2, y2, pointX, pointY, eraseThreshold);

    case TOOL_ITEMS.ARROW: {
      const { x3, y3, x4, y4 } = getArrowHeadsCoordinates(
        x1,
        y1,
        x2,
        y2,
        ARROW_LENGTH,
        eraseThreshold,
      );

      return (
        isPointCloseToLine(x1, y1, x2, y2, pointX, pointY, eraseThreshold) ||
        isPointCloseToLine(x2, y2, x3, y3, pointX, pointY, eraseThreshold) ||
        isPointCloseToLine(x2, y2, x4, y4, pointX, pointY, eraseThreshold)
      );
    }
    case TOOL_ITEMS.RECTANGLE: {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      const isInsideRectangle =
        pointX >= minX && pointX <= maxX && pointY >= minY && pointY <= maxY;

      if (element.fill != null && isInsideRectangle) {
        return true;
      }

      return (
        isPointCloseToLine(x1, y1, x2, y1, pointX, pointY, eraseThreshold) ||
        isPointCloseToLine(x2, y1, x2, y2, pointX, pointY, eraseThreshold) ||
        isPointCloseToLine(x2, y2, x1, y2, pointX, pointY, eraseThreshold) ||
        isPointCloseToLine(x1, y2, x1, y1, pointX, pointY, eraseThreshold)
      );
    }

    case TOOL_ITEMS.CIRCLE: {
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;

      const radiusX = Math.abs(x2 - x1) / 2;
      const radiusY = Math.abs(y2 - y1) / 2;

      if (radiusX === 0 || radiusY === 0) {
        return false;
      }

      const normalizedDistance = Math.sqrt(
        Math.pow((pointX - centerX) / radiusX, 2) +
          Math.pow((pointY - centerY) / radiusY, 2),
      );

      if (element.fill != null && normalizedDistance <= 1) {
        return true;
      }

      const distanceFromBorder =
        Math.abs(normalizedDistance - 1) * Math.min(radiusX, radiusY);

      return distanceFromBorder <= eraseThreshold;
    }
    case TOOL_ITEMS.BRUSH: {
      const rect = canvas.getBoundingClientRect();

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const canvasX = (pointX - rect.left) * scaleX;
      const canvasY = (pointY - rect.top) * scaleY;

      return context.isPointInPath(element.path, canvasX, canvasY);
    }
    case TOOL_ITEMS.TEXT: {
      context.font = `${element.size}px Caveat`;

      const lines = element.text.split("\n");
      const lineHeight = Number(element.size) * 1.2;

      const textWidth = Math.max(
        ...lines.map((line) => context.measureText(line).width),
      );

      const textHeight = (lines.length - 1) * lineHeight + Number(element.size);
      const padding = 5;

      return (
        pointX >= x1 - padding &&
        pointX <= x1 + textWidth + padding &&
        pointY >= y1 - padding &&
        pointY <= y1 + textHeight + padding
      );
    }

    default:
      throw new Error("Type not recognised");
  }
};

export const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"],
  );

  d.push("Z");
  return d.join(" ");
};
