import React, {
  useCallback,
  useContext,
  useReducer,
  useState,
  useEffect,
} from "react";

import boardContext from "./board-context";
import { BOARD_ACTIONS, TOOL_ACTION_TYPES, TOOL_ITEMS } from "../../constants";
import {
  createElement,
  getSvgPathFromStroke,
  isPointNearElement,
} from "../../utils/element";
import getStroke from "perfect-freehand";
import toolboxContext from "./toolbox-context";
import { loadBoardFromDB, saveBoardToDB } from "../../utils/indexedDB";

//const gen = rough.generator();
const STORAGE_KEY = "whiteboard-elements";

const rebuildElements = (savedElements) => {
  return savedElements.map((element) => {
    if (element.type === TOOL_ITEMS.BRUSH) {
      return {
        ...element,
        path: new Path2D(
          getSvgPathFromStroke(
            getStroke(element.points, {
              size: element.size,
            }),
          ),
        ),
      };
    }

    if (element.type === TOOL_ITEMS.TEXT) {
      return element;
    }

    return createElement(
      element.id,
      element.x1,
      element.y1,
      element.x2,
      element.y2,
      {
        type: element.type,
        stroke: element.stroke,
        fill: element.fill,
        size: element.size,
      },
    );
  });
};

const restoreElements = () => {
  try {
    const savedElements = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return rebuildElements(savedElements);
  } catch {
    return [];
  }
};
const boardReducer = (state, action) => {
  switch (action.type) {
    case BOARD_ACTIONS.LOAD_BOARD: {
      const elements = action.payload.elements;

      return {
        ...state,
        elements,
        history: [elements],
        index: 0,
      };
    }
    case BOARD_ACTIONS.CHANGE_TOOL: {
      return {
        ...state,
        activeToolItem: action.payload.tool,
      };
    }
    case BOARD_ACTIONS.CHANGE_ACTION_TYPE:
      return {
        ...state,
        toolActionType: action.payload.actionType,
      };
    case BOARD_ACTIONS.DRAW_DOWN: {
      const { clientX, clientY, stroke, fill, size } = action.payload;
      const newElement = createElement(
        state.elements.length,
        clientX,
        clientY,
        clientX,
        clientY,
        { type: state.activeToolItem, stroke, fill, size },
      );
      const prevElements = state.elements;
      return {
        ...state,
        toolActionType:
          state.activeToolItem === TOOL_ITEMS.TEXT
            ? TOOL_ACTION_TYPES.WRITING
            : TOOL_ACTION_TYPES.DRAWING,
        elements: [...prevElements, newElement],
      };
    }

    case BOARD_ACTIONS.DRAW_MOVE: {
      const { clientX, clientY } = action.payload;
      const newElements = [...state.elements];
      const index = state.elements.length - 1;
      const { type } = newElements[index];
      switch (type) {
        case TOOL_ITEMS.LINE:
        case TOOL_ITEMS.RECTANGLE:
        case TOOL_ITEMS.CIRCLE:
        case TOOL_ITEMS.ARROW:
          const { x1, y1, stroke, fill, size } = newElements[index];
          const newElement = createElement(index, x1, y1, clientX, clientY, {
            type: state.activeToolItem,
            stroke,
            fill,
            size,
          });
          newElements[index] = newElement;
          return {
            ...state,
            elements: newElements,
          };
        case TOOL_ITEMS.BRUSH:
          newElements[index].points = [
            ...newElements[index].points,
            { x: clientX, y: clientY },
          ];
          newElements[index].path = new Path2D(
            getSvgPathFromStroke(
              getStroke(newElements[index].points, {
                size: newElements[index].size,
              }),
            ),
          );
          return {
            ...state,
            elements: newElements,
          };
        default:
          throw new Error("Type not recognized");
      }
    }

    case BOARD_ACTIONS.DRAW_UP: {
      const lastElement = state.elements[state.elements.length - 1];

      if (
        lastElement.type !== TOOL_ITEMS.BRUSH &&
        Math.hypot(
          lastElement.x2 - lastElement.x1,
          lastElement.y2 - lastElement.y1,
        ) < 5
      ) {
        return {
          ...state,
          elements: state.elements.slice(0, -1),
        };
      }
      const elementsCopy = [...state.elements];
      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push(elementsCopy);
      return {
        ...state,
        history: newHistory,
        index: state.index + 1,
      };
    }
    case BOARD_ACTIONS.ERASE: {
      const { clientX, clientY } = action.payload;

      const newElements = state.elements.filter((element) => {
        return !isPointNearElement(element, clientX, clientY);
      });

      if (newElements.length === state.elements.length) {
        return state;
      }
      return {
        ...state,
        elements: newElements,
      };
    }
    case BOARD_ACTIONS.ERASE_END: {
      const previouslySavedElements = state.history[state.index];

      if (previouslySavedElements.length === state.elements.length) {
        return state;
      }

      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push([...state.elements]);

      return {
        ...state,
        history: newHistory,
        index: state.index + 1,
      };
    }

    case BOARD_ACTIONS.CHANGE_TEXT: {
      if (!action.payload.text.trim()) {
        return {
          ...state,
          toolActionType: TOOL_ACTION_TYPES.NONE,
          elements: state.elements.slice(0, -1),
        };
      }
      const index = state.elements.length - 1;
      const newElements = [...state.elements];
      newElements[index].text = action.payload.text;
      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push(newElements);

      return {
        ...state,
        toolActionType: TOOL_ACTION_TYPES.NONE,
        elements: newElements,
        history: newHistory,
        index: state.index + 1,
      };
    }
    case BOARD_ACTIONS.UNDO: {
      if (state.index <= 0) return state;
      return {
        ...state,
        elements: state.history[state.index - 1],
        index: state.index - 1,
      };
    }
    case BOARD_ACTIONS.REDO: {
      if (state.index >= state.history.length - 1) return state;
      return {
        ...state,
        elements: state.history[state.index + 1],
        index: state.index + 1,
      };
    }
    default:
      return state;
  }
};

const savedElements = restoreElements();

const initialBoardState = {
  activeToolItem: TOOL_ITEMS.BRUSH,
  toolActionType: TOOL_ACTION_TYPES.NONE,
  elements: savedElements,
  history: [savedElements],
  index: 0,
};

const BoardProvider = ({ children }) => {
  const [boardState, dispatchBoardAction] = useReducer(
    boardReducer,
    initialBoardState,
  );

  const [isBoardLoaded, setIsBoardLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadBoard = async () => {
      try {
        const storedElements = await loadBoardFromDB();

        if (isCancelled) return;

        if (storedElements.length > 0) {
          dispatchBoardAction({
            type: BOARD_ACTIONS.LOAD_BOARD,
            payload: {
              elements: rebuildElements(storedElements),
            },
          });
        } else if (initialBoardState.elements.length > 0) {
          await saveBoardToDB(initialBoardState.elements);
        }

        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Unable to load board", error);
      } finally {
        if (!isCancelled) {
          setIsBoardLoaded(true);
        }
      }
    };

    loadBoard();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isBoardLoaded) return;

    const saveTimeout = setTimeout(() => {
      saveBoardToDB(boardState.elements).catch((error) => {
        console.error("Unable to save board", error);
      });
    }, 500);

    return () => {
      clearTimeout(saveTimeout);
    };
  }, [boardState.elements, isBoardLoaded]);
  const changeToolHandler = (tool) => {
    dispatchBoardAction({
      type: BOARD_ACTIONS.CHANGE_TOOL,
      payload: {
        tool,
      },
    });
  };

  const boardMouseDownHandler = (event, toolboxState) => {
    if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;
    const { clientX, clientY } = event;
    if (boardState.activeToolItem === TOOL_ITEMS.ERASER) {
      dispatchBoardAction({
        type: BOARD_ACTIONS.CHANGE_ACTION_TYPE,
        payload: {
          actionType: TOOL_ACTION_TYPES.ERASING,
        },
      });

      dispatchBoardAction({
        type: BOARD_ACTIONS.ERASE,
        payload: {
          clientX,
          clientY,
        },
      });

      return;
    }
    dispatchBoardAction({
      type: BOARD_ACTIONS.DRAW_DOWN,
      payload: {
        clientX,
        clientY,
        stroke: toolboxState[boardState.activeToolItem]?.stroke,
        fill: toolboxState[boardState.activeToolItem]?.fill,
        size: toolboxState[boardState.activeToolItem]?.size,
      },
    });
  };

  const boardMouseMoveHandler = (event) => {
    if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;
    const { clientX, clientY } = event;
    if (boardState.toolActionType === TOOL_ACTION_TYPES.DRAWING) {
      dispatchBoardAction({
        type: BOARD_ACTIONS.DRAW_MOVE,
        payload: {
          clientX,
          clientY,
        },
      });
    } else if (boardState.toolActionType === TOOL_ACTION_TYPES.ERASING) {
      dispatchBoardAction({
        type: BOARD_ACTIONS.ERASE,
        payload: {
          clientX,
          clientY,
        },
      });
    }
  };

  const boardMouseUpHandler = () => {
    if (boardState.toolActionType === TOOL_ACTION_TYPES.WRITING) return;

    if (boardState.toolActionType === TOOL_ACTION_TYPES.DRAWING) {
      dispatchBoardAction({
        type: BOARD_ACTIONS.DRAW_UP,
      });
    } else if (boardState.toolActionType === TOOL_ACTION_TYPES.ERASING) {
      dispatchBoardAction({
        type: BOARD_ACTIONS.ERASE_END,
      });
    }

    dispatchBoardAction({
      type: BOARD_ACTIONS.CHANGE_ACTION_TYPE,
      payload: {
        actionType: TOOL_ACTION_TYPES.NONE,
      },
    });
  };

  const textAreaBlurHandler = (text) => {
    dispatchBoardAction({
      type: BOARD_ACTIONS.CHANGE_TEXT,
      payload: {
        text,
      },
    });
  };
  const boardUndoHandler = useCallback(() => {
    dispatchBoardAction({
      type: BOARD_ACTIONS.UNDO,
    });
  }, []);
  const boardRedoHandler = useCallback(() => {
    dispatchBoardAction({
      type: BOARD_ACTIONS.REDO,
    });
  }, []);

  const boardContextValue = {
    activeToolItem: boardState.activeToolItem,
    elements: boardState.elements,
    toolActionType: boardState.toolActionType,
    changeToolHandler,
    boardMouseDownHandler,
    boardMouseMoveHandler,
    boardMouseUpHandler,
    textAreaBlurHandler,
    undo: boardUndoHandler,
    redo: boardRedoHandler,
  };
  return (
    <boardContext.Provider value={boardContextValue}>
      {children}
    </boardContext.Provider>
  );
};

export default BoardProvider;
