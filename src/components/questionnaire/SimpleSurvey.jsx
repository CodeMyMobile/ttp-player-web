import PropTypes from "prop-types";
import { Component } from "react";

import "./SimpleSurvey.css";

const isDefined = (value) => value !== undefined && value !== null;

const defaultQuestionTextRenderer = (questionText, questionSubtext) => (
  <div className="simple-survey__prompt">
    <h2 className="simple-survey__title">
      {typeof questionText === "string" ? questionText : JSON.stringify(questionText)}
    </h2>
    {questionSubtext ? <p className="simple-survey__subtitle">{questionSubtext}</p> : null}
  </div>
);

const defaultOptionRenderer = (item, { selected, multiSelect }) => (
  <button
    type="button"
    className={`simple-survey__option${selected ? " simple-survey__option--selected" : ""}${
      multiSelect ? " simple-survey__option--multi" : ""
    }`}
  >
    <span className="simple-survey__option-indicator" aria-hidden="true">
      {selected ? "✓" : ""}
    </span>
    <span className="simple-survey__option-copy">
      <span className="simple-survey__option-label">{item.optionText ?? item.label ?? String(item.value ?? "")}</span>
      {item.optionDescription || item.description ? (
        <span className="simple-survey__option-description">
          {item.optionDescription ?? item.description}
        </span>
      ) : null}
    </span>
  </button>
);

const normalizeDateInputValue = (value, type) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (type === "date") return value.toISOString().slice(0, 10);
    if (type === "time") return value.toISOString().slice(11, 16);
    return value.toISOString().slice(0, 16);
  }
  if (typeof value === "string") {
    if (type === "date") return value.slice(0, 10);
    if (type === "time") return value.slice(0, 5);
    return value.slice(0, 16);
  }
  return "";
};

class SimpleSurvey extends Component {
  static propTypes = {
    survey: PropTypes.arrayOf(
      PropTypes.shape({
        questionType: PropTypes.string.isRequired,
        questionText: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        questionSubtext: PropTypes.string,
        questionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        answerRequired: PropTypes.bool,
        questionSettings: PropTypes.object,
        options: PropTypes.arrayOf(
          PropTypes.shape({
            optionText: PropTypes.string,
            optionDescription: PropTypes.string,
            label: PropTypes.string,
            description: PropTypes.string,
            value: PropTypes.any,
          }),
        ),
        placeholderText: PropTypes.string,
        defaultValue: PropTypes.any,
        answerText: PropTypes.any,
        answerMetadata: PropTypes.object,
      }).isRequired,
    ).isRequired,
    onAnswerSubmitted: PropTypes.func,
    onSurveyFinished: PropTypes.func,
    renderSelector: PropTypes.func,
    renderTextInput: PropTypes.func,
    renderTextArea: PropTypes.func,
    renderImageUpload: PropTypes.func,
    renderNumericInput: PropTypes.func,
    selectionGroupContainerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    containerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    navButtonContainerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    renderPrev: PropTypes.func,
    renderNext: PropTypes.func,
    renderFinished: PropTypes.func,
    renderInfo: PropTypes.func,
    renderQuestionText: PropTypes.func,
    autoAdvance: PropTypes.bool,
    onCurrentQuestionIndexChange: PropTypes.func,
    userPos: PropTypes.shape({
      latitude: PropTypes.number,
      longitude: PropTypes.number,
    }),
  };

  static defaultProps = {
    onAnswerSubmitted: undefined,
    onSurveyFinished: undefined,
    renderSelector: undefined,
    renderTextInput: undefined,
    renderTextArea: undefined,
    renderImageUpload: undefined,
    renderNumericInput: undefined,
    selectionGroupContainerStyle: undefined,
    containerStyle: undefined,
    navButtonContainerStyle: undefined,
    renderPrev: undefined,
    renderNext: undefined,
    renderFinished: undefined,
    renderInfo: undefined,
    renderQuestionText: undefined,
    autoAdvance: false,
    onCurrentQuestionIndexChange: undefined,
    userPos: undefined,
  };

  constructor(props) {
    super(props);
    const answers = props.survey.map((question) => {
      if (question.answerText || (question.answerMetadata && question.answerMetadata.value)) {
        return {
          questionId: question.questionId,
          value: question.answerText || question.answerMetadata.value,
          additionalText: question.answerMetadata?.additionalText ?? "",
        };
      }
      if (question.defaultValue !== undefined) {
        return {
          questionId: question.questionId,
          value: question.defaultValue,
        };
      }
      return undefined;
    });
    this.state = { currentQuestionIndex: 0, answers };
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.currentQuestionIndex !== this.state.currentQuestionIndex) {
      this.props.onCurrentQuestionIndexChange?.(this.state.currentQuestionIndex);
    }
  }

  getCurrentQuestion = () => this.props.survey[this.state.currentQuestionIndex];

  getCurrentAnswer = () => this.state.answers[this.state.currentQuestionIndex];

  getAnswers() {
    return this.state.answers.filter(Boolean);
  }

  updateAnswer = (answerForCurrentQuestion) => {
    this.setState((prevState) => {
      const answers = [...prevState.answers];
      answers[prevState.currentQuestionIndex] = answerForCurrentQuestion;
      return { answers };
    });
  };

  getHasAnswer = (answer = this.getCurrentAnswer()) => {
    if (!answer) return false;
    if (!isDefined(answer.value)) return false;
    if (typeof answer.value === "string") return answer.value.trim() !== "";
    if (Array.isArray(answer.value)) return answer.value.length > 0;
    return true;
  };

  validateMultipleSelectionSurveyAnswers = () => {
    const question = this.getCurrentQuestion();
    if (question.questionType !== "MultipleSelectionGroup") {
      throw new Error("validateMultipleSelectionSurveyAnswers was asked to validate a non MultipleSelectionGroup item");
    }
    const answer = this.getCurrentAnswer();
    const settings = question.questionSettings || {};
    const maxMultiSelect = Number(settings.maxMultiSelect || 1);
    const minMultiSelect = Number(settings.minMultiSelect || maxMultiSelect);
    return Array.isArray(answer?.value) && answer.value.length >= minMultiSelect;
  };

  canAdvance = () => {
    const question = this.getCurrentQuestion();
    if (question.questionType === "Info") return true;
    if (question.questionType === "MultipleSelectionGroup") return this.validateMultipleSelectionSurveyAnswers();
    return question.answerRequired ? this.getHasAnswer() : true;
  };

  goToNext = () => {
    const { onAnswerSubmitted, onSurveyFinished, survey } = this.props;
    const { currentQuestionIndex } = this.state;
    const answer = this.getCurrentAnswer();
    if (!this.canAdvance()) return;
    if (answer) onAnswerSubmitted?.(answer);
    if (currentQuestionIndex === survey.length - 1) {
      onSurveyFinished?.(this.getAnswers());
      return;
    }
    this.setState({ currentQuestionIndex: currentQuestionIndex + 1 });
  };

  goToPrevious = () => {
    this.setState((prevState) => ({
      currentQuestionIndex: Math.max(0, prevState.currentQuestionIndex - 1),
    }));
  };

  autoAdvance = () => {
    if (this.canAdvance()) this.goToNext();
  };

  getQuestionKey = (question, index = this.state.currentQuestionIndex) =>
    question.questionId ?? question.id ?? `question-${index}`;

  handleSingleSelect = (item) => {
    const question = this.getCurrentQuestion();
    const currentValue = this.getCurrentAnswer()?.value;
    const allowDeselect = question.questionSettings?.allowDeselect !== false;
    const nextValue =
      allowDeselect && currentValue && currentValue.value === item.value ? null : item;

    this.updateAnswer({
      questionId: this.getQuestionKey(question),
      value: nextValue,
    });

    const autoAdvanceThisQuestion = Boolean(question.questionSettings?.autoAdvance || this.props.autoAdvance);
    if (autoAdvanceThisQuestion && nextValue) {
      window.setTimeout(() => this.autoAdvance(), 0);
    }
  };

  handleMultiSelect = (item) => {
    const question = this.getCurrentQuestion();
    const currentAnswer = this.getCurrentAnswer();
    const currentValues = Array.isArray(currentAnswer?.value) ? currentAnswer.value : [];
    const exists = currentValues.some((entry) => entry.value === item.value);
    const maxMultiSelect = Number(question.questionSettings?.maxMultiSelect || currentValues.length + 1);
    let nextValues;

    if (exists) {
      nextValues = currentValues.filter((entry) => entry.value !== item.value);
    } else if (currentValues.length >= maxMultiSelect) {
      nextValues = [...currentValues.slice(1), item];
    } else {
      nextValues = [...currentValues, item];
    }

    this.updateAnswer({
      questionId: this.getQuestionKey(question),
      value: nextValues,
    });
  };

  renderQuestionText = (question) => {
    if (this.props.renderQuestionText) {
      return this.props.renderQuestionText(question.questionText, question.questionSubtext);
    }
    return defaultQuestionTextRenderer(question.questionText, question.questionSubtext);
  };

  renderPreviousButton = () => {
    const { renderPrev } = this.props;
    const disabled = this.state.currentQuestionIndex === 0;
    if (renderPrev) return renderPrev(this.goToPrevious, !disabled);
    return (
      <button type="button" className="simple-survey__button" onClick={this.goToPrevious} disabled={disabled}>
        Previous
      </button>
    );
  };

  renderFinishOrNextButton = () => {
    const enabled = this.canAdvance();
    const isLast = this.state.currentQuestionIndex === this.props.survey.length - 1;

    if (isLast && this.props.renderFinished) {
      return this.props.renderFinished(this.goToNext, enabled);
    }
    if (!isLast && this.props.renderNext) {
      return this.props.renderNext(this.goToNext, enabled);
    }

    return (
      <button
        type="button"
        className="simple-survey__button simple-survey__button--primary"
        onClick={this.goToNext}
        disabled={!enabled}
      >
        {isLast ? "Finish" : "Next"}
      </button>
    );
  };

  renderNavButtons = () => (
    <div className="simple-survey__actions" style={this.props.navButtonContainerStyle}>
      {this.renderPreviousButton()}
      {this.renderFinishOrNextButton()}
    </div>
  );

  renderSelectionGroup = () => {
    const question = this.getCurrentQuestion();
    const currentValue = this.getCurrentAnswer()?.value;
    const options = question.options || [];
    const renderSelector = this.props.renderSelector;

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <div className="simple-survey__options" style={this.props.selectionGroupContainerStyle}>
          {options.map((item, index) => {
            const selected = currentValue?.value === item.value;
            return (
              <div key={item.value ?? index} onClick={() => this.handleSingleSelect(item)}>
                {renderSelector
                  ? renderSelector(item, selected, index)
                  : defaultOptionRenderer(item, { selected, multiSelect: false })}
              </div>
            );
          })}
        </div>
        {this.renderNavButtons()}
      </div>
    );
  };

  renderMultipleSelectionGroup = () => {
    const question = this.getCurrentQuestion();
    const currentValues = Array.isArray(this.getCurrentAnswer()?.value) ? this.getCurrentAnswer().value : [];
    const options = question.options || [];
    const renderSelector = this.props.renderSelector;

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <div className="simple-survey__options" style={this.props.selectionGroupContainerStyle}>
          {options.map((item, index) => {
            const selected = currentValues.some((entry) => entry.value === item.value);
            return (
              <div key={item.value ?? index} onClick={() => this.handleMultiSelect(item)}>
                {renderSelector
                  ? renderSelector(item, selected, index)
                  : defaultOptionRenderer(item, { selected, multiSelect: true })}
              </div>
            );
          })}
        </div>
        {this.renderNavButtons()}
      </div>
    );
  };

  renderTextInputElement = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const value = answer?.value ?? question.answerMetadata?.value ?? question.defaultValue ?? "";

    if (this.props.renderTextInput) {
      return (
        <div className="simple-survey__question" style={this.props.containerStyle}>
          {this.renderQuestionText(question)}
          {this.props.renderTextInput(
            (nextValue) => this.updateAnswer({ questionId: this.getQuestionKey(question), value: nextValue }),
            value,
            question.placeholderText,
            this.props.autoAdvance ? this.autoAdvance : null,
          )}
          {this.renderNavButtons()}
        </div>
      );
    }

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <input
          className="simple-survey__field"
          type="text"
          value={value}
          placeholder={question.placeholderText || ""}
          onChange={(event) =>
            this.updateAnswer({ questionId: this.getQuestionKey(question), value: event.target.value })
          }
        />
        {this.renderNavButtons()}
      </div>
    );
  };

  renderTextAreaElement = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const value = answer?.value ?? question.answerMetadata?.value ?? question.defaultValue ?? "";

    if (this.props.renderTextArea) {
      return (
        <div className="simple-survey__question" style={this.props.containerStyle}>
          {this.renderQuestionText(question)}
          {this.props.renderTextArea(
            (nextValue) => this.updateAnswer({ questionId: this.getQuestionKey(question), value: nextValue }),
            value,
            question.placeholderText || "Enter detailed information here...",
            this.props.autoAdvance ? this.autoAdvance : null,
          )}
          {this.renderNavButtons()}
        </div>
      );
    }

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <textarea
          className="simple-survey__textarea"
          value={value}
          placeholder={question.placeholderText || "Enter detailed information here..."}
          onChange={(event) =>
            this.updateAnswer({ questionId: this.getQuestionKey(question), value: event.target.value })
          }
        />
        {this.renderNavButtons()}
      </div>
    );
  };

  renderNumeric = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const value = answer?.value ?? question.defaultValue ?? "";

    if (this.props.renderNumericInput) {
      return (
        <div className="simple-survey__question" style={this.props.containerStyle}>
          {this.renderQuestionText(question)}
          {this.props.renderNumericInput(
            (nextValue) => this.updateAnswer({ questionId: this.getQuestionKey(question), value: nextValue }),
            value,
            question.placeholderText,
            this.props.autoAdvance ? this.autoAdvance : null,
          )}
          {this.renderNavButtons()}
        </div>
      );
    }

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <input
          className="simple-survey__field"
          type="number"
          value={value}
          placeholder={question.placeholderText || ""}
          onChange={(event) =>
            this.updateAnswer({
              questionId: this.getQuestionKey(question),
              value: event.target.value === "" ? "" : Number(event.target.value),
            })
          }
        />
        {this.renderNavButtons()}
      </div>
    );
  };

  renderInfo = () => {
    const question = this.getCurrentQuestion();
    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.props.renderInfo ? this.props.renderInfo(question.questionText) : this.renderQuestionText(question)}
        {this.renderNavButtons()}
      </div>
    );
  };

  renderAddressPicker = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const currentValue = answer?.value?.formattedAddress ?? answer?.value ?? question.answerMetadata?.value ?? "";

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <input
          className="simple-survey__field"
          type="text"
          value={typeof currentValue === "string" ? currentValue : ""}
          placeholder={question.placeholderText || "Search or enter an address"}
          onChange={(event) =>
            this.updateAnswer({
              questionId: this.getQuestionKey(question),
              value: {
                formattedAddress: event.target.value,
              },
            })
          }
        />
        <p className="simple-survey__helper">
          Web placeholder for the native address picker. Wire your Google Places component here later.
        </p>
        {this.renderNavButtons()}
      </div>
    );
  };

  renderConditionalSelectionWithText = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer() || {};
    const selectedValue = answer.value?.value ?? null;
    const additionalText = answer.additionalText ?? question.answerMetadata?.additionalText ?? "";

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <div className="simple-survey__options" style={this.props.selectionGroupContainerStyle}>
          {(question.options || []).map((item, index) => {
            const selected = selectedValue === item.value;
            return (
              <div
                key={item.value ?? index}
                onClick={() =>
                  this.updateAnswer({
                    questionId: this.getQuestionKey(question),
                    questionType: question.questionType,
                    value: item,
                    additionalText: item.value === "other" ? additionalText : "",
                    answerMetadata: {
                      value: item,
                      additionalText: item.value === "other" ? additionalText : "",
                    },
                  })
                }
              >
                {this.props.renderSelector
                  ? this.props.renderSelector(item, selected, index)
                  : defaultOptionRenderer(item, { selected, multiSelect: false })}
              </div>
            );
          })}
        </div>
        {selectedValue === "other" ? (
          <input
            className="simple-survey__field"
            type="text"
            value={additionalText}
            placeholder="Please specify"
            onChange={(event) =>
              this.updateAnswer({
                questionId: this.getQuestionKey(question),
                questionType: question.questionType,
                value: answer.value,
                additionalText: event.target.value,
                answerMetadata: {
                  value: answer.value,
                  additionalText: event.target.value,
                },
              })
            }
          />
        ) : null}
        {this.renderNavButtons()}
      </div>
    );
  };

  renderMultiAddressPicker = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const currentValue = Array.isArray(answer?.value)
      ? answer.value.map((entry) => entry.formattedAddress || entry).join("\n")
      : "";

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <textarea
          className="simple-survey__textarea"
          value={currentValue}
          placeholder={question.placeholderText || "Enter one court or address per line"}
          onChange={(event) => {
            const items = event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((formattedAddress) => ({ formattedAddress }));
            this.updateAnswer({
              questionId: this.getQuestionKey(question),
              value: items,
            });
          }}
        />
        <p className="simple-survey__helper">
          Web placeholder for the native tennis court picker. Replace with your searchable court picker later.
        </p>
        {this.renderNavButtons()}
      </div>
    );
  };

  renderTemporalPicker = (type) => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const htmlType =
      type === "DateTimePicker" ? "datetime-local" : type === "DatePicker" ? "date" : "time";
    const value = normalizeDateInputValue(answer?.value ?? question.defaultValue, htmlType === "datetime-local" ? "datetime" : htmlType);

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <input
          className="simple-survey__picker"
          type={htmlType}
          value={value}
          onChange={(event) =>
            this.updateAnswer({ questionId: this.getQuestionKey(question), value: event.target.value })
          }
        />
        {this.renderNavButtons()}
      </div>
    );
  };

  renderImageUpload = () => {
    const question = this.getCurrentQuestion();
    const answer = this.getCurrentAnswer();
    const value = answer?.value ?? question.answerMetadata?.value ?? "";

    if (this.props.renderImageUpload) {
      return (
        <div className="simple-survey__question" style={this.props.containerStyle}>
          {this.renderQuestionText(question)}
          {this.props.renderImageUpload(
            (nextValue) => this.updateAnswer({ questionId: this.getQuestionKey(question), value: nextValue }),
            value,
            question.placeholderText || "Select an image",
            this.props.autoAdvance ? this.autoAdvance : null,
          )}
          {this.renderNavButtons()}
        </div>
      );
    }

    return (
      <div className="simple-survey__question" style={this.props.containerStyle}>
        {this.renderQuestionText(question)}
        <input
          className="simple-survey__image-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            this.updateAnswer({ questionId: this.getQuestionKey(question), value: file });
          }}
        />
        {typeof value === "string" && value ? (
          <img className="simple-survey__image-preview" src={value} alt="Uploaded preview" />
        ) : null}
        {this.renderNavButtons()}
      </div>
    );
  };

  render() {
    const { survey } = this.props;
    const currentQuestion = survey[this.state.currentQuestionIndex];

    if (!currentQuestion) {
      return null;
    }

    switch (currentQuestion.questionType) {
      case "SelectionGroup":
        return this.renderSelectionGroup();
      case "MultipleSelectionGroup":
        return this.renderMultipleSelectionGroup();
      case "TextInput":
        return this.renderTextInputElement();
      case "NumericInput":
        return this.renderNumeric();
      case "Info":
        return this.renderInfo();
      case "ConditionalSelectionWithText":
        return this.renderConditionalSelectionWithText();
      case "AddressPicker":
        return this.renderAddressPicker();
      case "MultiAddressPicker":
        return this.renderMultiAddressPicker();
      case "DateTimePicker":
        return this.renderTemporalPicker("DateTimePicker");
      case "DatePicker":
        return this.renderTemporalPicker("DatePicker");
      case "TimePicker":
        return this.renderTemporalPicker("TimePicker");
      case "TextArea":
        return this.renderTextAreaElement();
      case "ImageUpload":
        return this.renderImageUpload();
      default:
        return <div className="simple-survey__question" style={this.props.containerStyle} />;
    }
  }
}

export default SimpleSurvey;
