define(["Tone/core/Tone", "Tone/type/Type"], function(Tone){

	"use strict";

	/**
	 *  @class Tone.Param wraps the native Web Audio's AudioParam to provide
	 *         additional unit conversion functionality. It also
	 *         serves as a base-class for classes which have a single,
	 *         automatable parameter.
	 *  @extends {Tone.AudioNode}
	 *  @param  {AudioParam}  param  The parameter to wrap.
	 *  @param  {Tone.Type} units The units of the audio param.
	 *  @param  {Boolean} convert If the param should be converted.
	 */
	Tone.Param = function(){

		var options = Tone.defaults(arguments, ["param", "units", "convert"], Tone.Param);
		Tone.AudioNode.call(this);

		/**
		 *  The native parameter to control
		 *  @type  {AudioParam}
		 *  @private
		 */
		this._param = this.input = options.param;

		/**
		 *  The units of the parameter
		 *  @type {Tone.Type}
		 */
		this.units = options.units;

		/**
		 *  If the value should be converted or not
		 *  @type {Boolean}
		 */
		this.convert = options.convert;

		/**
		 *  True if the signal value is being overridden by
		 *  a connected signal.
		 *  @readOnly
		 *  @type  {boolean}
		 *  @private
		 */
		this.overridden = false;

		/**
		 *  If there is an LFO, this is where it is held.
		 *  @type  {Tone.LFO}
		 *  @private
		 */
		this._lfo = null;

		if (Tone.isObject(options.lfo)){
			this.value = options.lfo;
		} else if (!Tone.isUndef(options.value)){
			this.value = options.value;
		}
	};

	Tone.extend(Tone.Param, Tone.AudioNode);

	/**
	 *  Defaults
	 *  @type  {Object}
	 *  @const
	 */
	Tone.Param.defaults = {
		"units" : Tone.Type.Default,
		"convert" : true,
		"param" : undefined
	};

	/**
	 * The current value of the parameter.
	 * @memberOf Tone.Param#
	 * @type {Number}
	 * @name value
	 */
	Object.defineProperty(Tone.Param.prototype, "value", {
		get : function(){
			return this._toUnits(this._param.value);
		},
		set : function(value){
			if (Tone.isObject(value)){
				//throw an error if the LFO needs to be included
				if (Tone.isUndef(Tone.LFO)){
					throw new Error("Include 'Tone.LFO' to use an LFO as a Param value.");
				}
				//remove the old one
				if (this._lfo){
					this._lfo.dispose();
				}
				this._lfo = new Tone.LFO(value).start();
				this._lfo.connect(this.input);
			} else {
				var convertedVal = this._fromUnits(value);
				this._param.cancelScheduledValues(0);
				this._param.value = convertedVal;
			}
		}
	});

	/**
	 *  Convert the given value from the type specified by Tone.Param.units
	 *  into the destination value (such as Gain or Frequency).
	 *  @private
	 *  @param  {*} val the value to convert
	 *  @return {number}     the number which the value should be set to
	 */
	Tone.Param.prototype._fromUnits = function(val){
		if (this.convert || Tone.isUndef(this.convert)){
			switch(this.units){
				case Tone.Type.Time:
					return this.toSeconds(val);
				case Tone.Type.Frequency:
					return this.toFrequency(val);
				case Tone.Type.Decibels:
					return Tone.dbToGain(val);
				case Tone.Type.NormalRange:
					return Math.min(Math.max(val, 0), 1);
				case Tone.Type.AudioRange:
					return Math.min(Math.max(val, -1), 1);
				case Tone.Type.Positive:
					return Math.max(val, 0);
				default:
					return val;
			}
		} else {
			return val;
		}
	};

	/**
	 * Convert the parameters value into the units specified by Tone.Param.units.
	 * @private
	 * @param  {number} val the value to convert
	 * @return {number}
	 */
	Tone.Param.prototype._toUnits = function(val){
		if (this.convert || Tone.isUndef(this.convert)){
			switch(this.units){
				case Tone.Type.Decibels:
					return Tone.gainToDb(val);
				default:
					return val;
			}
		} else {
			return val;
		}
	};

	/**
	 *  the minimum output value
	 *  @type {Number}
	 *  @private
	 */
	Tone.Param.prototype._minOutput = 0.00001;

	/**
	 *  Schedules a parameter value change at the given time.
	 *  @param {*}	value The value to set the signal.
	 *  @param {Time}  time The time when the change should occur.
	 *  @returns {Tone.Param} this
	 *  @example
	 * //set the frequency to "G4" in exactly 1 second from now.
	 * freq.setValueAtTime("G4", "+1");
	 */
	Tone.Param.prototype.setValueAtTime = function(value, time){
		this._param.setValueAtTime(this._fromUnits(value), this.toSeconds(time));
		return this;
	};

	/**
	 *  Creates a schedule point with the current value at the current time.
	 *  This is useful for creating an automation anchor point in order to
	 *  schedule changes from the current value.
	 *
	 *  @param {number=} now (Optionally) pass the now value in.
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.setRampPoint = function(now){
		now = Tone.defaultArg(now, this.now());
		var currentVal = this._param.value;
		// exponentialRampToValueAt cannot ever ramp from or to 0
		// More info: https://bugzilla.mozilla.org/show_bug.cgi?id=1125600#c2
		if (currentVal === 0){
			currentVal = this._minOutput;
		}
		this._param.setValueAtTime(currentVal, now);
		return this;
	};

	/**
	 *  Schedules a linear continuous change in parameter value from the
	 *  previous scheduled parameter value to the given value.
	 *
	 *  @param  {number} value
	 *  @param  {Time} endTime
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.linearRampToValueAtTime = function(value, endTime){
		value = this._fromUnits(value);
		this._param.linearRampToValueAtTime(value, this.toSeconds(endTime));
		return this;
	};

	/**
	 *  Schedules an exponential continuous change in parameter value from
	 *  the previous scheduled parameter value to the given value.
	 *
	 *  @param  {number} value
	 *  @param  {Time} endTime
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.exponentialRampToValueAtTime = function(value, endTime){
		value = this._fromUnits(value);
		value = Math.max(this._minOutput, value);
		this._param.exponentialRampToValueAtTime(value, this.toSeconds(endTime));
		return this;
	};

	/**
	 *  Schedules an exponential continuous change in parameter value from
	 *  the current time and current value to the given value over the
	 *  duration of the rampTime.
	 *
	 *  @param  {number} value   The value to ramp to.
	 *  @param  {Time} rampTime the time that it takes the
	 *                               value to ramp from it's current value
	 *  @param {Time}	[startTime=now] 	When the ramp should start.
	 *  @returns {Tone.Param} this
	 *  @example
	 * //exponentially ramp to the value 2 over 4 seconds.
	 * signal.exponentialRampToValue(2, 4);
	 */
	Tone.Param.prototype.exponentialRampToValue = function(value, rampTime, startTime){
		startTime = this.toSeconds(startTime);
		this.setRampPoint(startTime);
		this.exponentialRampToValueAtTime(value, startTime + this.toSeconds(rampTime));
		return this;
	};

	/**
	 *  Schedules an linear continuous change in parameter value from
	 *  the current time and current value to the given value over the
	 *  duration of the rampTime.
	 *
	 *  @param  {number} value   The value to ramp to.
	 *  @param  {Time} rampTime the time that it takes the
	 *                               value to ramp from it's current value
	 *  @param {Time}	[startTime=now] 	When the ramp should start.
	 *  @returns {Tone.Param} this
	 *  @example
	 * //linearly ramp to the value 4 over 3 seconds.
	 * signal.linearRampToValue(4, 3);
	 */
	Tone.Param.prototype.linearRampToValue = function(value, rampTime, startTime){
		startTime = this.toSeconds(startTime);
		this.setRampPoint(startTime);
		this.linearRampToValueAtTime(value, startTime + this.toSeconds(rampTime));
		return this;
	};

	/**
	 *  Start exponentially approaching the target value at the given time with
	 *  a rate having the given time constant.
	 *  @param {number} value
	 *  @param {Time} startTime
	 *  @param {number} timeConstant
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.setTargetAtTime = function(value, startTime, timeConstant){
		value = this._fromUnits(value);
		// The value will never be able to approach without timeConstant > 0.
		// http://www.w3.org/TR/webaudio/#dfn-setTargetAtTime, where the equation
		// is described. 0 results in a division by 0.
		value = Math.max(this._minOutput, value);
		timeConstant = Math.max(this._minOutput, timeConstant);
		this._param.setTargetAtTime(value, this.toSeconds(startTime), timeConstant);
		return this;
	};

	/**
	 *  Sets an array of arbitrary parameter values starting at the given time
	 *  for the given duration.
	 *
	 *  @param {Array} values
	 *  @param {Time} startTime
	 *  @param {Time} duration
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.setValueCurveAtTime = function(values, startTime, duration){
		duration = this.toSeconds(duration);
		startTime = this.toSeconds(startTime);
		this.setValueAtTime(values[0], startTime);
		var segTime = duration / (values.length - 1);
		for (var i = 1; i < values.length; i++){
			this._param.linearRampToValueAtTime(this._fromUnits(values[i]), startTime + i * segTime);
		}
		return this;
	};

	/**
	 *  Cancels all scheduled parameter changes with times greater than or
	 *  equal to startTime.
	 *
	 *  @param  {Time} startTime
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.cancelScheduledValues = function(startTime){
		this._param.cancelScheduledValues(this.toSeconds(startTime));
		return this;
	};

	/**
	 *  Ramps to the given value over the duration of the rampTime.
	 *  Automatically selects the best ramp type (exponential or linear)
	 *  depending on the `units` of the signal
	 *
	 *  @param  {number} value
	 *  @param  {Time} rampTime 	The time that it takes the
	 *                              value to ramp from it's current value
	 *  @param {Time}	[startTime=now] 	When the ramp should start.
	 *  @returns {Tone.Param} this
	 *  @example
	 * //ramp to the value either linearly or exponentially
	 * //depending on the "units" value of the signal
	 * signal.rampTo(0, 10);
	 *  @example
	 * //schedule it to ramp starting at a specific time
	 * signal.rampTo(0, 10, 5)
	 */
	Tone.Param.prototype.rampTo = function(value, rampTime, startTime){
		rampTime = Tone.defaultArg(rampTime, 0);
		if (this.units === Tone.Type.Frequency || this.units === Tone.Type.BPM || this.units === Tone.Type.Decibels){
			this.exponentialRampToValue(value, rampTime, startTime);
		} else {
			this.linearRampToValue(value, rampTime, startTime);
		}
		return this;
	};

	/**
	 *  The LFO created by the signal instance. If none
	 *  was created, this is null.
	 *  @type {Tone.LFO}
	 *  @readOnly
	 *  @memberOf Tone.Param#
	 *  @name lfo
	 */
	Object.defineProperty(Tone.Param.prototype, "lfo", {
		get : function(){
			return this._lfo;
		}
	});

	/**
	 *  Clean up
	 *  @returns {Tone.Param} this
	 */
	Tone.Param.prototype.dispose = function(){
		Tone.AudioNode.prototype.dispose.call(this);
		this._param = null;
		if (this._lfo){
			this._lfo.dispose();
			this._lfo = null;
		}
		return this;
	};

	return Tone.Param;
});
