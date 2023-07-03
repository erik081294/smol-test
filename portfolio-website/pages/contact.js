import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

class Contact extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      email: '',
      message: '',
      successMessage: '',
      errorMessage: ''
    };
  }

  handleInputChange = (event) => {
    this.setState({
      [event.target.id]: event.target.value
    });
  }

  handleSubmit = (event) => {
    event.preventDefault();
    // Add your form submission logic here
  }

  render() {
    return (
      <div>
        <Header />
        <h1>Contact Me</h1>
        <form onSubmit={this.handleSubmit}>
          <label htmlFor="name">Name:</label>
          <input type="text" id="name" onChange={this.handleInputChange} />
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" onChange={this.handleInputChange} />
          <label htmlFor="message">Message:</label>
          <textarea id="message" onChange={this.handleInputChange} />
          <input type="submit" value="Submit" />
        </form>
        {this.state.successMessage && <p>{this.state.successMessage}</p>}
        {this.state.errorMessage && <p>{this.state.errorMessage}</p>}
        <Footer />
      </div>
    );
  }
}

export default Contact;