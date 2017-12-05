const Graph = require('./graph');
const Schema = require('./schema');
const { async, clone } = require('./util');
const Factory = require('./states/factory');
const { EventEmitter } = require('events');


class Machine extends EventEmitter {

    static create(json) {
        Schema.validate(json);
        return new Machine(json);
    }

    constructor({ StartAt, States }) {
        super();
        this.graph = new Graph();
        this.states = States;
        this.used = new Set();
        try {
            this.startAt = this.build(StartAt);
        } catch (err) {
            console.log(err.message);
            console.log(err.stack);
            throw err;
        }
    }

    build(name) {
        const { graph, states, used } = this;

        const fromState = clone(states[name]);
        fromState.Name = name;
        if (used.has(name)) {
            return fromState;
        }
        used.add(name);
        graph.addVertex(fromState);

        const addEdge = Next => {
            const toState = this.build(Next);
            graph.addEdge(fromState, toState, Next);
        };

        if (fromState.Next) {
            addEdge(fromState.Next);
        }

        if (fromState.Default) {
            addEdge(fromState.Default);
        }

        if (Array.isArray(fromState.Catch)) {
            fromState.Catch.forEach(({ Next }) => addEdge(Next));
        }

        if (Array.isArray(fromState.Choices)) {
            fromState.Choices.forEach(({ Next }) => addEdge(Next));
        }

        // Branches are handled internally to the Parallel State
        // because they don't define state transitions.

        return fromState;
    }

    run(input) {
        const { graph, startAt } = this;
        const run = this._runner();

        this.emit('ExecutionStarted', {
            input,
        });

        const resolve = output => {
            this.emit('ExecutionCompleted', {
                output,
            });

            return output;
        };

        const reject = output => Promise.reject(resolve(output));

        return run(graph, startAt, input).then(resolve, reject);
    }

    _runner() {
        return async(function *(graph, startAt, input) {
            let currentState = startAt;
            let result = input;

            while (currentState) {
                const { Name: name, Type: type } = currentState;

                this.emit('StateEntered', {
                    name,
                    input: result,
                });


                let output, next;
                try {

                    // Only build states that are executed in this
                    // particular invocation of the machine.
                    if (currentState.Name === 'Again') {
                        console.log(currentState);
                    }
                    const state = Factory.create(currentState, Machine);
                    ({ output, next } = yield state.run(result));

                    const nextState = graph.getVertexAt(currentState, next);
                    currentState = nextState;
                    result = clone(output);

                } catch (error) {

                    if (error instanceof Error) {
                        error = {
                            Error: error.message,
                            Cause: error.stack,
                        };
                    }

                    output = error;
                    next = undefined;
                    throw error;

                } finally {

                    this.emit('StateExited', {
                        name,
                        output,
                    });

                }
            }

            return result;
        }, this);
    }


}


module.exports = Machine;
